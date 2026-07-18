'use strict';

/**
 * E2E-ONLY deterministic LLM. Scripts the divorce interview turns keyed on
 * the user's message, deliberately reproducing the failure mode from the
 * original bug report: each turn emits ONLY the child under discussion, so
 * the orchestrator's merge logic is what keeps the family intact.
 */

function toolResponse(name, args) {
  return {
    choices: [
      {
        message: {
          tool_calls: [{ function: { name, arguments: JSON.stringify(args) } }],
        },
      },
    ],
  };
}

function scriptTurn(userText) {
  const t = userText.toLowerCase();

  if (t.includes('my name is brandon')) {
    return {
      response: "Nice to meet you, Brandon. What is your spouse's full name?",
      phase_complete: false,
      petitioner_first_name: 'Brandon',
      petitioner_last_name: 'Pritchard',
      extracted_facts: [
        { content: 'My name is Brandon Pritchard.', category: 'general' },
      ],
    };
  }
  if (t.includes('spouse') && t.includes('alex')) {
    return {
      response: 'Thanks. Which Utah county do you live in?',
      phase_complete: true,
      respondent_first_name: 'Alex',
      respondent_last_name: 'Pritchard',
    };
  }
  if (t.includes('salt lake county')) {
    return {
      response: 'Got it. When were you married?',
      phase_complete: true,
      state: 'UT',
      county: 'Salt Lake',
      residency_state_months: 72,
      extracted_facts: [
        { content: 'I have lived in Salt Lake County, Utah for six years.', category: 'residency' },
      ],
    };
  }
  if (t.includes('married on may 1, 2010')) {
    return {
      response: 'Thank you. Do you and Alex have minor children together?',
      phase_complete: true,
      marriage_date: '2010-05-01',
      marriage_city: 'Salt Lake City',
      marriage_state: 'Utah',
      separation_date: '2024-11-15',
      grounds: 'irreconcilable_differences',
      extracted_facts: [
        { content: 'We married on May 1, 2010 in Salt Lake City, Utah.', category: 'marriage' },
      ],
    };
  }
  // The bug repro: one child per turn, never re-sending prior ones.
  if (t.includes('oldest is emma')) {
    return {
      response: "Emma is recorded. Who's next?",
      phase_complete: false,
      children: [{ name: 'Emma Pritchard', dob: '2015-04-02' }],
    };
  }
  if (t.includes('liam')) {
    return {
      response: 'Liam is recorded. Any other children?',
      phase_complete: false,
      children: [{ name: 'Liam Pritchard', dob: '2017-06-15' }],
    };
  }
  if (t.includes('forgot') && t.includes('ava')) {
    // The exact "reminder" turn that used to wipe the first two children.
    return {
      response: 'Of course — Ava is recorded too. That completes the children section.',
      phase_complete: true,
      children: [{ name: 'Ava Pritchard', dob: '2019-09-09' }],
      children_confirmed: true,
      custody_arrangement: 'joint',
      extracted_facts: [
        { content: 'We have three children: Emma, Liam, and Ava.', category: 'children' },
      ],
    };
  }
  return {
    response: 'Understood. Tell me more when you are ready.',
    phase_complete: false,
  };
}

module.exports = {
  async chat(messages, opts) {
    const requested = opts?.tool_choice?.function?.name || 'process_phase_data';

    if (requested === 'ingest_court_document') {
      return toolResponse('ingest_court_document', {
        document_kind: 'Original petition served on you',
        events: [
          { label: 'Filed', date: '2026-06-20' },
          { label: 'Served', date: '2026-06-28' },
        ],
        facts: [
          {
            content: 'The petition asks the court to divide the marital estate.',
            category: 'response',
          },
        ],
      });
    }

    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    const raw = String(lastUser?.content || '');
    const userText = raw.includes('USER MESSAGE:')
      ? raw.slice(raw.indexOf('USER MESSAGE:') + 'USER MESSAGE:'.length)
      : raw;
    return toolResponse(requested, scriptTurn(userText.trim()));
  },
};
