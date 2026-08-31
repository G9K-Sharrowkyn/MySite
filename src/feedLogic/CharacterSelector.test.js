import { fireEvent, render, screen } from '@testing-library/react';
import CharacterSelector from './CharacterSelector';

const characters = [
  {
    id: 'darkseid-dc',
    name: 'Darkseid (DC)',
    universe: 'DC',
    image: '/characters/Darkseid (DC).jpg'
  },
  {
    id: 'darth-bane-sw',
    name: 'Darth Bane (SW)',
    universe: 'Star Wars',
    image: '/characters/Darth Bane (Star Wars).jpg'
  }
];

describe('CharacterSelector', () => {
  test('shows character thumbnails alongside matching names', () => {
    render(
      <CharacterSelector
        characters={characters}
        selectedCharacter={null}
        onSelect={jest.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Type to search characters...'), {
      target: { value: 'd' }
    });

    expect(screen.getByText('Darkseid (DC)')).toBeInTheDocument();
    expect(screen.getByText('Darth Bane (SW)')).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: /portrait$/i })).toHaveLength(2);
  });
});
