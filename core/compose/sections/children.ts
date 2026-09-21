/**
 * Children — one paragraph per child on the record, each supported by the
 * child's id. "There are no children" is dispositive and renders ONLY from
 * the `no_children` confirmation (DISPOSITIVE_CLAUSES); an empty children
 * list without it is silence and renders a blank.
 */

import type { Child } from '../../model/types';
import type { Block, Section } from '../types';
import type { DivorceContext } from '../context';
import { formatDate, isRenderableDate } from '../dates';
import { blank, confirmed, note, paragraph, section } from '../record';
import type { Labels } from '../record';

export const CHILDREN_SECTION = 'children';

const RESIDES_WITH: Record<NonNullable<Child['residesWith']>['value'], (labels: Labels) => string> = {
  self: (l) => `resides with ${l.self}`,
  other: (l) => `resides with ${l.other}`,
  shared: () => 'resides with both parties under a shared arrangement',
  third_party: () => 'resides with a third party',
};

function childParagraph(child: Child, index: number, ctx: DivorceContext): Block[] {
  const { labels, language } = ctx;
  const name = child.name?.value ?? `Child ${index + 1}`;
  const dob = child.dateOfBirth?.value;
  const parts: string[] = [name];
  if (typeof dob === 'string' && isRenderableDate(dob)) parts.push(`born ${formatDate(dob, language)}`);
  else if (typeof child.age?.value === 'number') parts.push(`aged ${child.age.value}`);
  const residence = child.residesWith?.value;
  if (residence) parts.push(`who ${RESIDES_WITH[residence](labels)}`);
  const blocks: Block[] = [paragraph(`${parts.join(', ')}, is a child of the marriage.`, [child.id])];
  if (typeof dob !== 'string' || !isRenderableDate(dob)) {
    if (typeof child.age?.value !== 'number') blocks.push(note(`Draft — state ${name}'s date of birth; the court needs it for every child.`));
  }
  return blocks;
}

export function childrenSection(ctx: DivorceContext): Section {
  const { file } = ctx;
  const blocks: Block[] = [];

  if (file.children.length > 0) {
    blocks.push(paragraph(`There ${file.children.length === 1 ? 'is one child' : `are ${file.children.length} children`} of the marriage, named below.`, file.children.map((c) => c.id)));
    file.children.forEach((child, i) => blocks.push(...childParagraph(child, i, ctx)));
    blocks.push(
      blank(
        'childResidenceHistory',
        `Draft — for each child, state where the child has lived for the past five years and whether any other court case concerns the child. Courts require this before making parenting orders.`,
        'Residence history of the children',
        'During the past five years each child has lived at ___, and no other court case concerns the children except ___.',
      ),
    );
  } else if (confirmed(file, 'no_children')) {
    // Dispositive: only the confirmation supports it.
    blocks.push(paragraph('There are no children of the marriage, born or adopted, and none are expected.', ['no_children']));
  } else {
    blocks.push(blank('children', `Draft — list every child of the marriage (name, date of birth, who they live with), or confirm in the interview that there are none. Nothing about children has been assumed.`, 'Children', 'The children of the marriage are ___.'));
  }

  return section(CHILDREN_SECTION, 'Children', blocks);
}
