import type { TextMatchTransformer } from '@lexical/markdown';
import { $createPortalNode, $isPortalNode, PortalNode } from './PortalNode';

export const PortalTransformer: TextMatchTransformer = {
  type: 'text-match',
  dependencies: [PortalNode],
  importRegExp: /!(?:\[([^[]*)\])(?:\(([^(]+)\))/,
  regExp: /!(?:\[([^\]]*)\])(?:\(([^\)]*)\))/,
  replace(parentNode, match) {
    const [, alt, src] = match;
    const node = $createPortalNode(alt, src);
    parentNode.replace(node);
  },
  export(node) {
    if (!$isPortalNode(node)) {
      return null;
    }
    if (node.hasValue()) {
      return node.getValue() || null;
    }
    return `![${node.getAlt()}](${node.getSrc()})`;
  },
  trigger: ')',
};
