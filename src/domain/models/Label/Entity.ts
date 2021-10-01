import IntervalTree from "@flatten-js/interval-tree";
import { Text } from "./Text";

export class Entity {
  constructor(
    readonly id: number,
    readonly label: number,
    readonly user: number,
    readonly startOffset: number,
    readonly endOffset: number
  ) {}

  isIn(startOffset: number, endOffset: number): boolean {
    return (
      (startOffset <= this.startOffset && this.startOffset < endOffset) ||
      (startOffset < this.endOffset && this.endOffset <= endOffset) ||
      (this.startOffset < startOffset && endOffset < this.endOffset)
    );
  }
}

export class Entities {
  private tree: IntervalTree<Entity> = new IntervalTree();
  private id2entity: Map<number, Entity> = new Map();

  constructor(entities: Entity[]) {
    for (const entity of entities) {
      this.tree.insert([entity.startOffset, entity.endOffset], entity);
      this.id2entity.set(entity.id, entity);
    }
  }

  static valueOf(entities: Entity[], text?: Text): Entities {
    return new Entities(
      entities.map(
        (entity) =>
          new Entity(
            entity.id,
            entity.label,
            entity.user,
            text
              ? text.toCodePointOffset(entity.startOffset)
              : entity.startOffset,
            text ? text.toCodePointOffset(entity.endOffset) : entity.endOffset
          )
      )
    );
  }

  get size(): number {
    return this.tree.size;
  }

  list(): Entity[] {
    return this.tree.values;
  }

  findById(id: number): Entity {
    return this.id2entity.get(id)!;
  }

  filterByRange(startOffset: number, endOffset: number): Entity[] {
    return this.tree
      .search([startOffset, endOffset])
      .filter((entity: Entity) => entity.isIn(startOffset, endOffset));
  }
}

export class LevelManager {
  private labelIntervalPerLevel: IntervalTree[] = [];
  private entityLevel: Map<number, number> = new Map(); // <entity.id, level>

  update(entity: Entity, ranges: [number, number][]): void {
    for (const [level, tree] of this.labelIntervalPerLevel.entries()) {
      if (ranges.every((range) => !tree.intersect_any(range))) {
        ranges.forEach((range) => {
          tree.insert(range);
        });
        this.entityLevel.set(entity.id, level);
        return;
      }
    }
    this.entityLevel.set(entity.id, this.labelIntervalPerLevel.length);
    const tree = new IntervalTree();
    ranges.forEach((range) => {
      tree.insert(range);
    });
    this.labelIntervalPerLevel.push(tree);
  }

  fetchLevel(entity: Entity): number | undefined {
    return this.entityLevel.get(entity.id);
  }

  get maxLevel(): number {
    return Math.max(Math.max(...this.entityLevel.values()) + 1, 0);
  }

  clear(): void {
    this.labelIntervalPerLevel = [];
    this.entityLevel.clear();
  }
}
