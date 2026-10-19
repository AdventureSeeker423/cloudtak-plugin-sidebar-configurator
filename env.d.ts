declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-empty-object-type
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.json' {
  const value: unknown;
  export default value;
}

declare module 'sortablejs' {
  export interface SortableEvent {
    oldIndex?: number;
    newIndex?: number;
  }
  export interface Options {
    animation?: number;
    handle?: string;
    dataIdAttr?: string;
    onEnd?: (evt: SortableEvent) => void;
  }
  export default class Sortable {
    constructor(el: HTMLElement, options?: Options);
    toArray(): string[];
    destroy(): void;
    el: HTMLElement;
  }
}
