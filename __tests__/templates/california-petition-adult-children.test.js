/**
 * CA v7 replay guard: Section V of the California FL-100 petition must
 * plead adult children as adults and never collapse a
 * (numberOfChildren>0, hasMinorChildren=false) case into the flat
 * "no children were born or adopted of this marriage" denial (Alison
 * replay, 2026-08).
 */

const CaliforniaDivorcePetitionTemplate =
  require('../../templates/states/california/DivorcePetitionTemplate');

function renderChildrenSection(data) {
  const tpl = new CaliforniaDivorcePetitionTemplate();
  const section = tpl.generateChildrenSection(data);
  const body = section.items.map((i) => i.content).join('\n');
  return { section, body };
}

describe('California petition Section V — children', () => {
  test('0 children: pleads no children born/adopted, section titled "CHILDREN OF THE MARRIAGE"', () => {
    const { section, body } = renderChildrenSection({
      numberOfChildren: 0,
      hasMinorChildren: false,
      children: [],
    });
    expect(body).toMatch(/No children were born or adopted of this marriage/);
    expect(body).not.toMatch(/adult (child|children)/);
    expect(section.title).toBe('V. CHILDREN OF THE MARRIAGE');
  });

  test('2 adult children with no children[] array: pleads count and section titled "CHILDREN OF THE MARRIAGE" (Alison replay)', () => {
    const { section, body } = renderChildrenSection({
      numberOfChildren: 2,
      hasMinorChildren: false,
    });
    expect(body).not.toMatch(/No children were born or adopted/);
    expect(body).toMatch(/There are 2 adult children of the marriage/);
    expect(body).toMatch(/no orders regarding custody, visitation, or child support are requested/);
    expect(section.title).toBe('V. CHILDREN OF THE MARRIAGE');
  });

  test('1 minor child: pleads UCCJEA attachment and lists child with DOB, section titled "MINOR CHILDREN"', () => {
    const dob = '2015-06-01';
    const { section, body } = renderChildrenSection({
      numberOfChildren: 1,
      hasMinorChildren: true,
      children: [{ name: 'Junie', birthDate: dob }],
    });
    expect(body).toMatch(/UCCJEA/);
    expect(body).toMatch(/Junie, born /);
    expect(body).not.toMatch(/\[CHILD NAME\]/);
    expect(body).not.toMatch(/\[BIRTH DATE\]/);
    expect(section.title).toBe('V. MINOR CHILDREN');
  });

  test('2 minor children + 1 adult: pleads UCCJEA and enumerates children, titled "MINOR CHILDREN"', () => {
    const { section, body } = renderChildrenSection({
      numberOfChildren: 3,
      hasMinorChildren: true,
      children: [
        { name: 'Ava', birthDate: '2012-03-01' },
        { name: 'Ben', birthDate: '2016-09-15' },
        { name: 'Cara', birthDate: '2001-01-04' },
      ],
    });
    expect(body).toMatch(/UCCJEA/);
    expect(body).toMatch(/Ava, born /);
    expect(body).toMatch(/Ben, born /);
    expect(body).toMatch(/Cara, born /);
    expect(section.title).toBe('V. MINOR CHILDREN');
  });

  test('Alison v8-B replay: 25 nameless age-only entries (2 real kids, ages 24/21) plead as 2 adult children, never 25', () => {
    // Exact profile.children shape written by the extractor when the LLM
    // re-emitted the same two anonymous kids across every turn and
    // childrenMerge (no name, no dob → no identity) appended each time
    // up to MAX_CHILDREN=25. From
    // scratchpad/v8b-replay/alison-profile.json.
    const children = [];
    for (let i = 0; i < 12; i += 1) {
      children.push({ age: 24 });
      children.push({ age: 21 });
    }
    children.push({ age: 24 }); // 25th entry — cap hit
    expect(children).toHaveLength(25);

    const { section, body } = renderChildrenSection({
      hasMinorChildren: false,
      children,
      // numberOfChildren deliberately absent — extractor did not emit it,
      // and the count must still come out right from the array alone.
    });
    expect(body).toMatch(/There are 2 adult children of the marriage/);
    expect(body).not.toMatch(/25 adult children/);
    expect(body).not.toMatch(/No children were born or adopted/);
    expect(section.title).toBe('V. CHILDREN OF THE MARRIAGE');
  });

  test('v10-A shape: numberOfChildren=2, children=null, hasMinorChildren=false → 2 adult children', () => {
    const { section, body } = renderChildrenSection({
      numberOfChildren: 2,
      hasMinorChildren: false,
      children: null,
    });
    expect(body).toMatch(/There are 2 adult children of the marriage/);
    expect(body).not.toMatch(/No children were born or adopted/);
    expect(section.title).toBe('V. CHILDREN OF THE MARRIAGE');
  });

  test('narrative-only: no count, no children[], but facts mention "two adult children" → count-less adult-children pleading', () => {
    const { section, body } = renderChildrenSection({
      hasMinorChildren: false,
      numberOfChildren: null,
      children: null,
      facts: [{ content: 'they have two adult children' }],
    });
    expect(body).toMatch(/There are adult children of the marriage/);
    expect(body).not.toMatch(/No children were born or adopted/);
    expect(body).not.toMatch(/\b\d+ adult children\b/);
    expect(section.title).toBe('V. CHILDREN OF THE MARRIAGE');
  });

  test('no signals at all: hasMinorChildren=false, no count, no children[], no facts → flat denial preserved', () => {
    const { section, body } = renderChildrenSection({
      hasMinorChildren: false,
      numberOfChildren: null,
      children: null,
    });
    expect(body).toMatch(/No children were born or adopted of this marriage/);
    expect(body).not.toMatch(/adult (child|children)/);
    expect(section.title).toBe('V. CHILDREN OF THE MARRIAGE');
  });

  test('2 adult children with named children[]: names appear alongside adult-child count', () => {
    const { section, body } = renderChildrenSection({
      numberOfChildren: 2,
      hasMinorChildren: false,
      children: [
        { name: 'Alice', birthDate: '2001-05-01' },
        { name: 'Bob', birthDate: '2004-08-22' },
      ],
    });
    expect(body).toMatch(/There are 2 adult children of the marriage/);
    expect(body).toMatch(/Alice/);
    expect(body).toMatch(/Bob/);
    expect(section.title).toBe('V. CHILDREN OF THE MARRIAGE');
  });
});
