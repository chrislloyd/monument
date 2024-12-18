import { createCommand, DecoratorNode, type LexicalNode, type NodeKey } from "lexical";
import type { ReactNode } from "react";
import Portal from "./Portal";

export const UPDATE_PORTAL_VALUE_COMMAND = createCommand('UPDATE_PORTAL_VALUE_COMMAND');

export class PortalNode extends DecoratorNode<ReactNode> {
  __alt: string;
  __src: string;
  __value: string | undefined;

  static getType(): string {
    return 'portal';
  }

  static clone(node: PortalNode): PortalNode {
    return new PortalNode(node.__alt, node.__src, node.__value, node.__key);
  }

  constructor(alt: string, src: string, value: string | undefined, key?: NodeKey) {
    super(key);
    this.__alt = alt;
    this.__src = src;
    this.__value = value;
  }

  createDOM(): HTMLElement {
    return document.createElement('span');
  }

  isInline(): boolean {
    return true;
  }

  updateDOM(): boolean {
    return false;
  }

  decorate(): ReactNode {
    return <Portal alt={this.__alt} src={this.__src} value={this.__value} onChange={this.handleValueChange.bind(this)} />;
  }

  handleValueChange(nextValue: string) {
    const next = this.getWritable();
    next.__value = nextValue;
  }

  getAlt() {
    const latest = this.getLatest();
    return latest.__alt;
  }

  getSrc() {
    const latest = this.getLatest();
    return latest.__src;
  }

  getValue() {
    const latest = this.getLatest();
    return latest.__value;
  }

  hasValue(): boolean {
    const value = this.getValue();
    return value !== undefined;
  }
}

export function $createPortalNode(alt: string, src: string): PortalNode {
  return new PortalNode(alt, src, undefined);
}

export function $isPortalNode(
  node: LexicalNode | null | undefined,
): node is PortalNode {
  return node instanceof PortalNode;
}
