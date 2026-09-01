// __tests__/templates/newyork-petition-uccjea.test.js
//
// The NY petition MUST include a UCCJEA / home-state declaration
// (DRL §75-a et seq.) whenever the case touches custody of a minor.
// Bug context (2026-08 coverage sweep): Emma (age 6) was named as a
// child of the marriage but no UCCJEA section rendered.

const NewYorkDivorcePetitionTemplate = require('../../templates/states/newyork/DivorcePetitionTemplate');

function baseData(overrides = {}) {
  return {
    petitionerName: 'Alex Chen',
    respondentName: 'Robin Chen',
    state: 'NY',
    county: 'New York',
    marriageDate: '2010-06-01',
    ...overrides,
  };
}

function uccjeaTypes(items) {
  return items.filter((i) => typeof i.type === 'string' && i.type.startsWith('uccjea_'));
}

describe('New York petition — UCCJEA / home-state declaration', () => {
  const petition = new NewYorkDivorcePetitionTemplate();

  test('renders UCCJEA header + child address + prior-address + other-actions items when minor children are present', () => {
    const section = petition.generateChildrenSection(
      baseData({
        hasMinorChildren: true,
        children: [{ name: 'Emma Chen', dob: '2020-04-02', currentAddress: '123 Main St, New York, NY' }],
      })
    );
    const u = uccjeaTypes(section.items);
    expect(u.length).toBeGreaterThanOrEqual(4);
    expect(u.find((i) => i.type === 'uccjea_header')).toBeTruthy();
    expect(u.find((i) => i.type === 'uccjea_home_state').content).toMatch(/Uniform Child Custody Jurisdiction and Enforcement Act/);
    expect(u.find((i) => i.type === 'uccjea_home_state').content).toMatch(/§\s*75-a/);
    expect(u.find((i) => i.type === 'uccjea_child_address').content).toMatch(/Emma Chen/);
    expect(u.find((i) => i.type === 'uccjea_child_address').content).toMatch(/123 Main St/);
    expect(u.find((i) => i.type === 'uccjea_prior_addresses')).toBeTruthy();
    expect(u.find((i) => i.type === 'uccjea_other_actions').content).toMatch(/no such pending proceeding/i);
  });

  test('renders UCCJEA when only children[] with a young dob is present (no hasMinorChildren flag)', () => {
    const section = petition.generateChildrenSection(
      baseData({ children: [{ name: 'Emma Chen', dob: '2020-04-02' }] })
    );
    expect(uccjeaTypes(section.items).length).toBeGreaterThan(0);
  });

  test('OMITS UCCJEA section when there are no children of the marriage', () => {
    const section = petition.generateChildrenSection(baseData({ hasMinorChildren: false }));
    expect(uccjeaTypes(section.items)).toHaveLength(0);
  });

  test('OMITS UCCJEA section when every child is over 18 (adult children only)', () => {
    const section = petition.generateChildrenSection(
      baseData({
        hasMinorChildren: false,
        children: [
          { name: 'Adult Child A', dob: '1995-01-01' },
          { name: 'Adult Child B', dob: '2000-05-15' },
        ],
      })
    );
    expect(uccjeaTypes(section.items)).toHaveLength(0);
  });

  test('lists pending custody actions when disclosed', () => {
    const section = petition.generateChildrenSection(
      baseData({
        hasMinorChildren: true,
        children: [{ name: 'Emma Chen', dob: '2020-04-02' }],
        pendingCustodyActions: ['Family Court New York County, Docket V-1234-24'],
      })
    );
    const other = uccjeaTypes(section.items).find((i) => i.type === 'uccjea_other_actions');
    expect(other.content).toMatch(/V-1234-24/);
    expect(other.content).not.toMatch(/no such pending proceeding/i);
  });

  test('renders prior addresses verbatim when the child has them on file', () => {
    const section = petition.generateChildrenSection(
      baseData({
        hasMinorChildren: true,
        children: [
          {
            name: 'Emma Chen',
            dob: '2020-04-02',
            priorAddresses: ['45 Oak Ave, Brooklyn, NY (2020–2023)', '10 Elm St, Queens, NY (2023–2024)'],
          },
        ],
      })
    );
    const prior = uccjeaTypes(section.items).find((i) => i.type === 'uccjea_prior_addresses');
    expect(prior.content).toMatch(/45 Oak Ave/);
    expect(prior.content).toMatch(/10 Elm St/);
  });
});
