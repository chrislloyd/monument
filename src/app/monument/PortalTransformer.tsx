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
    return `![${node.__alt}](${node.__src})`;
  },
  trigger: ')',
};
