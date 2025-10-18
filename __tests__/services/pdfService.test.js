const fs = require('fs');
const path = require('path');

jest.mock('fs', () => {
  const original = jest.requireActual('fs');
  return {
    ...original,
    promises: original.promises,
    createWriteStream: jest.fn(() => {
      // minimal writable stream mock
      const { PassThrough } = require('stream');
      const s = new PassThrough();
      process.nextTick(() => s.emit('finish'));
      return s;
    })
  };
});

jest.mock('pdfkit', () => {
  return jest.fn().mockImplementation(() => {
    const EventEmitter = require('events');
    const stream = new EventEmitter();
    stream.pipe = jest.fn(() => stream);
    stream.end = jest.fn(() => process.nextTick(() => stream.emit('finish')));
    stream.text = jest.fn();
    stream.fontSize = jest.fn(() => stream);
    stream.font = jest.fn(() => stream);
    stream.addPage = jest.fn();
    stream.rect = jest.fn(() => stream);
    stream.stroke = jest.fn(() => stream);
    stream.y = 0;
    stream.page = { width: 612, height: 792, margins: { left: 72, right: 72, bottom: 72 } };
    stream.moveDown = jest.fn(() => { stream.y += 12; return stream; });
    stream.moveUp = jest.fn(() => { stream.y = Math.max(0, stream.y - 12); return stream; });
    stream.moveTo = jest.fn(() => stream);
    stream.lineTo = jest.fn(() => stream);
    stream._pageBuffer = [1];
    stream._fontSize = 12;
    stream.widthOfString = jest.fn(() => 40);
    stream.heightOfString = jest.fn(() => 12);
    return stream;
  });
});

const PDFService = require('../../services/pdfService');

describe('PDFService', () => {
  test('generatePDF resolves and produces metadata', async () => {
    const pdfService = new PDFService();
    const doc = {
      sections: {
        header: 'THE STATE OF TEST',
        venue: 'COUNTY OF TEST',
        caseCaption: 'Case 123',
        title: 'AFFIDAVIT',
        introduction: 'Intro text',
        facts: [ { content: 'Fact one' }, { content: 'Fact two' } ],
        conclusion: 'Conclusion here',
        perjuryStatement: 'I declare under penalty of perjury.'
      },
      metadata: { affiantName: 'Tester' }
    };

    const result = await pdfService.generatePDF(doc, { documentId: 'test' });
    expect(result).toHaveProperty('filepath');
    expect(result).toHaveProperty('filename');
    expect(result.success).toBe(true);
  });
});
