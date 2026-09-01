/** @jest-environment node */
// Tests for services/ResilientOpenAIService.js — the Luna-family Responses
// API routing added so `openAIService.chat(messages, {tools, tool_choice})`
// stays the single call site for every orchestrator, even on models that
// don't support function tools in /v1/chat/completions.

const {
  ResilientOpenAIService,
  chatToResponsesRequest,
  responsesToChatCompletion,
} = require('../../services/ResilientOpenAIService');

// Divorce-orchestrator-shaped tool: what BaseDivorceOrchestrator sends today.
const DIVORCE_TOOL = {
  type: 'function',
  function: {
    name: 'process_phase_data',
    description: 'Extract phase data from the user message.',
    parameters: {
      type: 'object',
      properties: {
        response: { type: 'string' },
        phase_complete: { type: 'boolean' },
        extracted_facts: { type: 'array', items: { type: 'string' } },
      },
      required: ['response'],
      additionalProperties: false,
    },
  },
};

describe('chatToResponsesRequest — Chat Completions → Responses API request', () => {
  test('flattens tool and tool_choice, converts messages, renames token budget', () => {
    const req = chatToResponsesRequest({
      model: 'gpt-5.6-luna',
      messages: [
        { role: 'system', content: 'You are a divorce intake orchestrator.' },
        { role: 'user', content: 'My spouse and I want to divorce.' },
      ],
      tools: [DIVORCE_TOOL],
      tool_choice: { type: 'function', function: { name: 'process_phase_data' } },
      max_completion_tokens: 1500,
    });

    expect(req.model).toBe('gpt-5.6-luna');

    // system → developer, and every content becomes [{type:'input_text', text}]
    expect(req.input).toEqual([
      { role: 'developer', content: [{ type: 'input_text', text: 'You are a divorce intake orchestrator.' }] },
      { role: 'user',      content: [{ type: 'input_text', text: 'My spouse and I want to divorce.' }] },
    ]);

    // Tools flat (no nested `function`)
    expect(req.tools).toHaveLength(1);
    expect(req.tools[0]).toEqual({
      type: 'function',
      name: 'process_phase_data',
      description: DIVORCE_TOOL.function.description,
      parameters: DIVORCE_TOOL.function.parameters,
    });

    // tool_choice: name lifted out of the nested function wrapper
    expect(req.tool_choice).toEqual({ type: 'function', name: 'process_phase_data' });

    // Token budget renamed
    expect(req.max_output_tokens).toBe(1500);
    expect(req.max_tokens).toBeUndefined();
    expect(req.max_completion_tokens).toBeUndefined();
  });

  test('falls back to max_tokens when max_completion_tokens is absent', () => {
    const req = chatToResponsesRequest({
      model: 'gpt-5.6-luna',
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 200,
    });
    expect(req.max_output_tokens).toBe(200);
  });

  test('passes through string tool_choice values (auto/none/required)', () => {
    const req = chatToResponsesRequest({
      model: 'gpt-5.6-luna',
      messages: [{ role: 'user', content: 'hi' }],
      tool_choice: 'auto',
    });
    expect(req.tool_choice).toBe('auto');
  });
});

describe('responsesToChatCompletion — Responses envelope → Chat Completions envelope', () => {
  test('maps a function_call output back to choices[0].message.tool_calls[0].function.arguments', () => {
    // Shape captured from a live gpt-5.6-luna probe.
    const raw = {
      id: 'resp_0e166e50194252a9006a91a708260487d2956ebb2020078068',
      model: 'gpt-5.6-luna',
      status: 'completed',
      output: [
        {
          id: 'fc_0e166e50194252a9006a91a70908dc87d2a8e01dabe622095b',
          type: 'function_call',
          status: 'completed',
          call_id: 'call_IhrKq7IxiroXTgUVlidkvN9j',
          name: 'process_phase_data',
          arguments: '{"response":"Got it.","phase_complete":true,"extracted_facts":["divorce intent"]}',
        },
      ],
      usage: { input_tokens: 79, output_tokens: 24, total_tokens: 103 },
    };

    const chat = responsesToChatCompletion(raw, 'gpt-5.6-luna');

    // Every current caller reads it exactly this way — see
    // services/agents/BaseDivorceOrchestrator.js:603 and siblings.
    const toolCall = chat.choices[0].message.tool_calls[0];
    expect(toolCall.type).toBe('function');
    expect(toolCall.id).toBe('call_IhrKq7IxiroXTgUVlidkvN9j');
    expect(toolCall.function.name).toBe('process_phase_data');
    const parsed = JSON.parse(toolCall.function.arguments);
    expect(parsed.response).toBe('Got it.');
    expect(parsed.phase_complete).toBe(true);
    expect(parsed.extracted_facts).toEqual(['divorce intent']);

    expect(chat.choices[0].finish_reason).toBe('tool_calls');
    expect(chat.model).toBe('gpt-5.6-luna');
    expect(chat.usage).toEqual({ prompt_tokens: 79, completion_tokens: 24, total_tokens: 103 });
  });

  test('surfaces plain assistant text when there is no function_call', () => {
    const raw = {
      id: 'resp_plain',
      model: 'gpt-5.6-luna',
      status: 'completed',
      output_text: 'Hello there.',
      output: [
        { type: 'message', content: [{ type: 'output_text', text: 'Hello there.' }] },
      ],
      usage: { input_tokens: 5, output_tokens: 3, total_tokens: 8 },
    };
    const chat = responsesToChatCompletion(raw, 'gpt-5.6-luna');
    expect(chat.choices[0].message.tool_calls).toBeUndefined();
    expect(chat.choices[0].message.content).toBe('Hello there.');
    expect(chat.choices[0].finish_reason).toBe('stop');
  });

  test('non-string arguments get JSON-stringified for downstream JSON.parse', () => {
    const raw = {
      output: [{ type: 'function_call', name: 'x', call_id: 'c1', arguments: { a: 1 } }],
    };
    const chat = responsesToChatCompletion(raw, 'gpt-5.6-luna');
    const args = chat.choices[0].message.tool_calls[0].function.arguments;
    expect(typeof args).toBe('string');
    expect(JSON.parse(args)).toEqual({ a: 1 });
  });
});

describe('ResilientOpenAIService.chat — model-based routing', () => {
  function makeFakeClient() {
    return {
      chat: {
        completions: {
          create: jest.fn(async () => ({
            choices: [{ message: { role: 'assistant', content: 'chat-path' }, finish_reason: 'stop' }],
            usage: {},
          })),
        },
      },
      responses: {
        create: jest.fn(async () => ({
          id: 'resp_test',
          model: 'gpt-5.6-luna',
          status: 'completed',
          output: [
            {
              type: 'function_call',
              call_id: 'call_test',
              name: 'process_phase_data',
              arguments: '{"response":"ok","phase_complete":false}',
            },
          ],
          usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
        })),
      },
    };
  }

  test('gpt-5.6-luna hits the Responses path and returns a Chat-Completions-shaped tool_call', async () => {
    const fake = makeFakeClient();
    const svc = new ResilientOpenAIService(fake, { maxRetries: 0 });

    const resp = await svc.chat(
      [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'hi' },
      ],
      {
        model: 'gpt-5.6-luna',
        tools: [DIVORCE_TOOL],
        tool_choice: { type: 'function', function: { name: 'process_phase_data' } },
        max_tokens: 1500,
        temperature: 0.3, // stripped by normalizeChatParams for GPT-5 family
      }
    );

    expect(fake.responses.create).toHaveBeenCalledTimes(1);
    expect(fake.chat.completions.create).not.toHaveBeenCalled();

    // Request shape delivered to responses.create
    const [reqArg] = fake.responses.create.mock.calls[0];
    expect(reqArg.model).toBe('gpt-5.6-luna');
    expect(reqArg.tool_choice).toEqual({ type: 'function', name: 'process_phase_data' });
    expect(reqArg.tools[0].name).toBe('process_phase_data');
    expect(reqArg.tools[0].function).toBeUndefined();
    expect(reqArg.max_output_tokens).toBe(1500);
    expect(reqArg.input[0]).toEqual({ role: 'developer', content: [{ type: 'input_text', text: 'sys' }] });

    // Response shape after conversion
    const args = JSON.parse(resp.choices[0].message.tool_calls[0].function.arguments);
    expect(args.response).toBe('ok');
    expect(args.phase_complete).toBe(false);
  });

  test('gpt-5-nano stays on Chat Completions (no Responses call)', async () => {
    const fake = makeFakeClient();
    const svc = new ResilientOpenAIService(fake, { maxRetries: 0 });

    await svc.chat([{ role: 'user', content: 'hi' }], {
      model: 'gpt-5-nano',
      tools: [DIVORCE_TOOL],
      tool_choice: { type: 'function', function: { name: 'process_phase_data' } },
      max_tokens: 500,
    });

    expect(fake.chat.completions.create).toHaveBeenCalledTimes(1);
    expect(fake.responses.create).not.toHaveBeenCalled();
    const [reqArg] = fake.chat.completions.create.mock.calls[0];
    expect(reqArg.model).toBe('gpt-5-nano');
    // Chat Completions retains its native tool shape
    expect(reqArg.tools[0].function.name).toBe('process_phase_data');
    expect(reqArg.tool_choice).toEqual({ type: 'function', function: { name: 'process_phase_data' } });
  });
});

describe('chatToResponsesRequest role-aware content type', () => {
  const { chatToResponsesRequest } = require('@/services/ResilientOpenAIService');
  test('assistant messages use output_text (Responses API rejects input_text on assistant)', () => {
    const req = chatToResponsesRequest({
      model: 'gpt-5.6-luna',
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'hello' },
        { role: 'user', content: 'more' },
      ],
    });
    const types = req.input.map(m => ({ role: m.role, t: m.content[0].type }));
    expect(types).toEqual([
      { role: 'developer', t: 'input_text' },
      { role: 'user',      t: 'input_text' },
      { role: 'assistant', t: 'output_text' },
      { role: 'user',      t: 'input_text' },
    ]);
  });
});
