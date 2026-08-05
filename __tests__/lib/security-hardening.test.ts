/** @jest-environment node */

import {
  assertGenerationTypeAllowed,
  buildDocumentStructure,
  generateSchema,
  resolveGenerationDocumentType,
} from '../../app/api/documents/generate/route';

const AllowedFileType = require('../../utils/allowedFileType') as {
  fromBuffer: (buffer: Buffer) => { mime: string; ext: string } | undefined;
};

describe('document generation entitlement input', () => {
  const affidavitData = { state: 'TX', facts: [] };

  it('rejects generation without a persisted document ID', () => {
    expect(generateSchema.safeParse({ affidavitData }).success).toBe(false);
  });

  it.each(['0', '-1', '1abc', '2147483648'])(
    'rejects invalid document ID %s',
    (documentId) => {
      expect(generateSchema.safeParse({ affidavitData, documentId }).success).toBe(false);
    },
  );

  it('accepts a bounded positive document ID', () => {
    expect(generateSchema.safeParse({ affidavitData, documentId: 42 }).success).toBe(true);
  });
});

describe('divorce document generation routing', () => {
  it('prevents paid affidavit rows from generating divorce outputs', () => {
    expect(() =>
      assertGenerationTypeAllowed('general', 'divorce_package', 'divorce_petition'),
    ).toThrow('does not match');
  });

  it('prevents divorce rows from generating affidavit outputs', () => {
    expect(() => assertGenerationTypeAllowed('divorce_package', 'general', null)).toThrow(
      'does not match',
    );
  });

  it('allows package rows to generate either supported package output', () => {
    expect(() =>
      assertGenerationTypeAllowed('divorce_package', 'divorce_package', 'divorce_decree'),
    ).not.toThrow();
  });

  it('keeps standalone decree rows bound to decree output', () => {
    expect(() =>
      assertGenerationTypeAllowed('divorce_decree', 'divorce_petition', null),
    ).toThrow('does not match');
  });

  it.each([
    ['divorce_package', undefined, 'divorce_petition'],
    ['divorce_package', null, 'divorce_petition'],
    ['divorce_package', 'divorce_decree', 'divorce_decree'],
    ['divorce_package', 'final_judgment', 'divorce_decree'],
    ['divorce_petition', undefined, 'divorce_petition'],
    ['divorce_decree', undefined, 'divorce_decree'],
    ['general', undefined, 'affidavit'],
  ])('resolves %s / %s to %s', (type, active, expected) => {
    expect(resolveGenerationDocumentType(type, active)).toBe(expected);
  });

  it('rejects an unknown divorce package selection instead of generating an affidavit', () => {
    expect(() =>
      resolveGenerationDocumentType('divorce_package', 'unknown_document'),
    ).toThrow('Unsupported divorce package document selection');
  });

  it('routes a package petition through the dedicated petition generator and maps names', () => {
    const manager = {
      hasDocumentType: jest.fn().mockReturnValue(true),
      generateAffidavit: jest.fn(),
      generateDivorcePetition: jest.fn().mockReturnValue({ documentType: 'petition' }),
      generateDivorceDecree: jest.fn(),
    };

    const result = buildDocumentStructure(manager, 'TX', {
      state: 'TX',
      documentType: 'divorce_package',
      activeSubDocument: 'divorce_petition',
      petitionerFirstName: 'Alex',
      petitionerLastName: 'Smith',
      respondentFirstName: 'Taylor',
      respondentLastName: 'Smith',
    });

    expect(result).toEqual({ documentType: 'petition' });
    expect(manager.hasDocumentType).toHaveBeenCalledWith('TX', 'divorce_petition');
    expect(manager.generateDivorcePetition).toHaveBeenCalledWith(
      'TX',
      expect.objectContaining({
        petitionerName: 'Alex Smith',
        respondentName: 'Taylor Smith',
      }),
    );
    expect(manager.generateAffidavit).not.toHaveBeenCalled();
    expect(manager.generateDivorceDecree).not.toHaveBeenCalled();
  });

  it('routes a package decree through the dedicated decree generator', () => {
    const manager = {
      hasDocumentType: jest.fn().mockReturnValue(true),
      generateAffidavit: jest.fn(),
      generateDivorcePetition: jest.fn(),
      generateDivorceDecree: jest.fn().mockReturnValue({ documentType: 'decree' }),
    };

    expect(
      buildDocumentStructure(manager, 'ON', {
        state: 'ON',
        documentType: 'divorce_package',
        activeSubDocument: 'divorce_decree',
      }),
    ).toEqual({ documentType: 'decree' });
    expect(manager.generateDivorceDecree).toHaveBeenCalledWith('ON', expect.any(Object));
    expect(manager.generateDivorcePetition).not.toHaveBeenCalled();
  });

  it('fails closed when the jurisdiction lacks the selected divorce template', () => {
    const manager = {
      hasDocumentType: jest.fn().mockReturnValue(false),
      generateAffidavit: jest.fn(),
      generateDivorcePetition: jest.fn(),
      generateDivorceDecree: jest.fn(),
    };

    expect(() =>
      buildDocumentStructure(manager, 'TX', {
        state: 'TX',
        documentType: 'divorce_decree',
      }),
    ).toThrow('No divorce decree template is available for this jurisdiction');
    expect(manager.generateDivorceDecree).not.toHaveBeenCalled();
  });
});

describe('narrow evidence signature detection', () => {
  it('detects the three supported formats', () => {
    expect(AllowedFileType.fromBuffer(Buffer.from('%PDF-1.7'))?.mime).toBe(
      'application/pdf',
    );
    expect(
      AllowedFileType.fromBuffer(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))?.mime,
    ).toBe('image/jpeg');
    expect(
      AllowedFileType.fromBuffer(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      )?.mime,
    ).toBe('image/png');
  });

  it('rejects unrelated container formats and text', () => {
    expect(AllowedFileType.fromBuffer(Buffer.from('GIF89a'))).toBeUndefined();
    expect(AllowedFileType.fromBuffer(Buffer.from('plain text'))).toBeUndefined();
  });
});
