import { DecoratorNode, type LexicalNode, type NodeKey } from "lexical";
import type { ReactNode } from "react";
import Portal from "./Portal";

export class PortalNode extends DecoratorNode<ReactNode> {
  __alt: string;
  __src: string;

  __value: string;

  static getType(): string {
    return 'portal';
  }

  static clone(node: PortalNode): PortalNode {
    return new PortalNode(node.__alt, node.__src, node.__key);
  }

  constructor(alt: string, src: string, key?: NodeKey) {
    super(key);
    this.__alt = alt;
    this.__src = src;
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
    return <Portal alt={this.__alt} src={this.__src} />;
  }
}

export function $createPortalNode(alt: string, src: string): PortalNode {
  return new PortalNode(alt, src);
}

export function $isPortalNode(
  node: LexicalNode | null | undefined,
): node is PortalNode {
  return node instanceof PortalNode;
}
