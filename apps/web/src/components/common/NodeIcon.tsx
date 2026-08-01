import {
  Brain,
  Broom,
  ChartLine,
  Database,
  FileText,
  Function as FunctionIcon,
  GitFork,
  MagnifyingGlass,
  Sparkle,
} from '@phosphor-icons/react';
import type { ComponentProps } from 'react';

import type { NodeIconKey } from '../../types/workflow';

const icons = {
  database: Database,
  magnify: MagnifyingGlass,
  broom: Broom,
  split: GitFork,
  brain: Brain,
  chart: ChartLine,
  spark: Sparkle,
  sigma: FunctionIcon,
  file: FileText,
} satisfies Record<NodeIconKey, React.ComponentType<ComponentProps<typeof Database>>>;

interface NodeIconProps extends ComponentProps<typeof Database> {
  icon: NodeIconKey;
}

export function NodeIcon({ icon, ...props }: NodeIconProps) {
  const Icon = icons[icon];
  return <Icon {...props} />;
}
