// Drawing prompts organized by categories
const prompts = {
  animals: [
    'lion', 'elephant', 'giraffe', 'penguin', 'dog', 'cat', 'rabbit', 'monkey',
    'tiger', 'bear', 'fish', 'bird', 'snake', 'butterfly', 'dolphin'
  ],
  objects: [
    'chair', 'table', 'lamp', 'book', 'clock', 'phone', 'computer', 'glasses',
    'cup', 'umbrella', 'backpack', 'camera', 'television', 'guitar'
  ],
  nature: [
    'tree', 'flower', 'mountain', 'sun', 'moon', 'star', 'cloud', 'rainbow',
    'beach', 'river', 'forest', 'volcano', 'island', 'waterfall'
  ],
  food: [
    'pizza', 'hamburger', 'ice cream', 'cake', 'apple', 'banana', 'sushi',
    'sandwich', 'cookie', 'donut', 'taco', 'pasta', 'popcorn'
  ],
  vehicles: [
    'car', 'bicycle', 'airplane', 'boat', 'train', 'rocket', 'helicopter',
    'motorcycle', 'submarine', 'truck', 'spaceship'
  ],
  fantasy: [
    'dragon', 'unicorn', 'wizard', 'robot', 'alien', 'monster', 'superhero',
    'pirate', 'mermaid', 'fairy', 'ghost', 'ninja'
  ],
  buildings: [
    'house', 'castle', 'skyscraper', 'lighthouse', 'bridge', 'windmill',
    'temple', 'igloo', 'pyramid', 'barn'
  ],
  sports: [
    'baseball', 'basketball', 'soccer ball', 'tennis racket', 'football',
    'skateboard', 'surfboard', 'hockey stick', 'bowling pin'
  ]
};

// Get a random prompt from a specific category
function getRandomPromptFromCategory(category) {
  const categoryPrompts = prompts[category];
  if (!categoryPrompts) {
    throw new Error(`Category "${category}" not found`);
  }
  return categoryPrompts[Math.floor(Math.random() * categoryPrompts.length)];
}

// Get a random prompt from any category
function getRandomPrompt() {
  const categories = Object.keys(prompts);
  const randomCategory = categories[Math.floor(Math.random() * categories.length)];
  return {
    prompt: getRandomPromptFromCategory(randomCategory),
    category: randomCategory
  };
}

module.exports = {
  prompts,
  getRandomPrompt,
  getRandomPromptFromCategory
};
