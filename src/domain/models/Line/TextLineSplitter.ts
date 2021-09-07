import { TextLine } from "./TextLine";
import { WidthCalculator } from "./Strategy";
import { Entities, Entity, LevelManager } from "../Label/Entity";
import { EntityLabels } from "./Shape";

export interface BaseLineSplitter {
  split(
    text: string,
    startOffset: number,
    entities?: Entities
  ): Iterable<TextLine>;
}

export class TextLineSplitter implements BaseLineSplitter {
  private levels: Map<number, number> = new Map();
  private levelManager = new LevelManager();
  private chunkWidth: Map<number, number> = new Map();
  constructor(
    private widthCalculator: WidthCalculator,
    private entityLabels: EntityLabels
  ) {}

  *split(
    text: string,
    startOffset = 0,
    entities: Entities
  ): Iterable<TextLine> {
    this.calculateChunkWidth(text);
    this.widthCalculator.reset();
    this.resetLevels();

    for (let i = startOffset; i < text.length; i++) {
      const ch = text[i];
      if (this.needsNewline(i, ch, entities)) {
        const line = new TextLine(startOffset, i);
        line.level = this.levelManager.maxLevel;
        yield line;
        startOffset = ch === "\n" ? i + 1 : i;
        this.widthCalculator.reset();
        this.resetLevels();
      }
      if (entities.startsAt(i)) {
        const _entities = entities.getAt(i);
        _entities.forEach((entity) => {
          this.levelManager.update(
            entity,
            this.widthCalculator.width,
            this.widthCalculator.width +
              this.entityLabels.getById(entity.label)!.width
          );
        });
        _entities.forEach((e) => this.updateLevel(e));
      }
      this.widthCalculator.add(ch);
    }
    if (this.widthCalculator.remains()) {
      const line = new TextLine(startOffset, text.length);
      line.level = this.levelManager.maxLevel;
      yield line;
    }
  }

  private calculateChunkWidth(text: string): void {
    let isInsideWord = false;
    let start = 0;
    this.widthCalculator.reset();
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (!isInsideWord && ch !== " ") {
        // word starts
        isInsideWord = true;
        start = i;
        this.widthCalculator.add(ch);
      } else if (!isInsideWord && ch === " ") {
        // space is continuous.
      } else if (isInsideWord && ch !== " ") {
        this.widthCalculator.add(ch);
      } else if (isInsideWord && ch === " ") {
        isInsideWord = false;
        this.chunkWidth.set(start, this.widthCalculator.width);
        this.widthCalculator.reset();
      }
    }
    if (isInsideWord) {
      this.chunkWidth.set(start, this.widthCalculator.width);
    }
  }

  private needsNewline(i: number, ch: string, entities: Entities): boolean {
    // check whether the word exceeds the maxWidth
    const wordWidth = this.chunkWidth.get(i) || 0;
    if (this.widthCalculator.needsNewline(ch, wordWidth)) {
      return true;
    }

    // check whether the label exceeds the maxWidth
    const _entities = entities.getAt(i);
    if (_entities.length === 0) {
      return this.widthCalculator.needsNewline(ch, 0);
    } else {
      const labelIds = _entities.map((e) => e.label);
      const maxLabelWidth = this.entityLabels.maxLabelWidth(labelIds);
      return this.widthCalculator.needsNewline(ch, maxLabelWidth);
    }
  }

  private updateLevel(entity: Entity): void {
    const level = this.levelManager.fetchLevel(entity)!;
    const entityLabel = this.entityLabels.getById(entity.label)!;
    const x = this.widthCalculator.width;
    this.levels.set(level, x + entityLabel.width);
  }

  private resetLevels(): void {
    this.levels.clear();
    this.levelManager.clear();
  }
}
