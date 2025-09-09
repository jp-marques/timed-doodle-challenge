import type { JSX } from 'react';
import { Shuffle, PawPrint, Box, Leaf, Utensils, Car, Wand2, Building2, Trophy } from 'lucide-react';

export type CategoryKey =
  | 'random'
  | 'animals'
  | 'objects'
  | 'nature'
  | 'food'
  | 'vehicles'
  | 'fantasy'
  | 'buildings'
  | 'sports';

export const categories: Array<{ key: CategoryKey; label: string; icon: JSX.Element }> = [
  { key: 'random', label: 'Random', icon: (<Shuffle size={20} />) },
  { key: 'animals', label: 'Animals', icon: (<PawPrint size={20} />) },
  { key: 'objects', label: 'Objects', icon: (<Box size={20} />) },
  { key: 'nature', label: 'Nature', icon: (<Leaf size={20} />) },
  { key: 'food', label: 'Food', icon: (<Utensils size={20} />) },
  { key: 'vehicles', label: 'Vehicles', icon: (<Car size={20} />) },
  { key: 'fantasy', label: 'Fantasy', icon: (<Wand2 size={20} />) },
  { key: 'buildings', label: 'Buildings', icon: (<Building2 size={20} />) },
  { key: 'sports', label: 'Sports', icon: (<Trophy size={20} />) },
];

export function getCategoryIcon(category: string): JSX.Element {
  switch (category) {
    case 'animals':
      return (<PawPrint size={32} />);
    case 'objects':
      return (<Box size={32} />);
    case 'nature':
      return (<Leaf size={32} />);
    case 'food':
      return (<Utensils size={32} />);
    case 'vehicles':
      return (<Car size={32} />);
    case 'fantasy':
      return (<Wand2 size={32} />);
    case 'buildings':
      return (<Building2 size={32} />);
    case 'sports':
      return (<Trophy size={32} />);
    default:
      return (<Shuffle size={32} />);
  }
}

