import Character from '../models/Character.js';
import Tag from '../models/Tag.js';
import Post from '../models/Post.js';

class TaggingService {
  constructor() {
    this.universeKeywords = {
      'DC': ['batman', 'superman', 'wonder woman', 'flash', 'green lantern', 'aquaman', 'cyborg', 'joker', 'lex luthor', 'darkseid', 'gotham', 'metropolis', 'krypton', 'atlantis'],
      'Marvel': ['spider-man', 'iron man', 'captain america', 'thor', 'hulk', 'black widow', 'hawkeye', 'doctor strange', 'wolverine', 'deadpool', 'thanos', 'loki', 'avengers', 'x-men', 'wakanda', 'asgard'],
      'Dragon Ball': ['goku', 'vegeta', 'gohan', 'piccolo', 'frieza', 'cell', 'majin buu', 'beerus', 'whis', 'saiyan', 'namek', 'kamehameha', 'ki', 'dragon balls'],
      'Naruto': ['naruto', 'sasuke', 'sakura', 'kakashi', 'itachi', 'madara', 'hashirama', 'minato', 'jiraiya', 'orochimaru', 'akatsuki', 'sharingan', 'byakugan', 'rinnegan', 'chakra', 'jutsu', 'konoha'],
      'One Piece': ['luffy', 'zoro', 'sanji', 'nami', 'usopp', 'chopper', 'robin', 'franky', 'brook', 'jinbe', 'shanks', 'whitebeard', 'kaido', 'big mom', 'blackbeard', 'devil fruit', 'haki', 'grand line'],
      'Attack on Titan': ['eren', 'mikasa', 'armin', 'levi', 'erwin', 'annie', 'reiner', 'bertholdt', 'titan', 'survey corps', 'wall maria', 'wall rose', 'wall sina', 'paradis'],
      'Demon Slayer': ['tanjiro', 'nezuko', 'zenitsu', 'inosuke', 'giyu', 'shinobu', 'rengoku', 'tengen', 'muzan', 'demon', 'hashira', 'breathing', 'nichirin'],
      'JJK': ['yuji', 'megumi', 'nobara', 'gojo', 'sukuna', 'nanami', 'maki', 'inumaki', 'panda', 'cursed spirit', 'cursed technique', 'domain expansion', 'jujutsu'],
      'Bleach': ['ichigo', 'rukia', 'uryu', 'chad', 'orihime', 'byakuya', 'kenpachi', 'toshiro', 'aizen', 'yamamoto', 'hollow', 'shinigami', 'quincy', 'zanpakuto', 'bankai', 'soul society'],
      'One Punch Man': ['saitama', 'genos', 'king', 'tatsumaki', 'fubuki', 'bang', 'atomic samurai', 'child emperor', 'metal knight', 'zombieman', 'hero association', 'monster association'],
      'My Hero Academia': ['deku', 'bakugo', 'todoroki', 'uraraka', 'iida', 'all might', 'endeavor', 'aizawa', 'shigaraki', 'dabi', 'toga', 'quirk', 'one for all', 'all for one', 'ua', 'hero', 'villain']
    };

    this.powerTierKeywords = {
      'Regular People': ['human', 'normal', 'civilian', 'regular', 'ordinary', 'mortal'],
      'Metahuman': ['superhuman', 'enhanced', 'mutant', 'powered', 'ability', 'meta'],
      'Planet Busters': ['planetary', 'world destroyer', 'planet level', 'continental', 'surface wiper'],
      'God Tier': ['god', 'deity', 'divine', 'celestial', 'cosmic', 'universal'],
      'Universal Threat': ['universal', 'multiverse', 'reality warper', 'dimension', 'omniversal'],
      'Omnipotent': ['omnipotent', 'all powerful', 'supreme', 'absolute', 'infinite power']
    };

    this.categoryKeywords = {
      'Hero': ['hero', 'good guy', 'protector', 'savior', 'champion', 'defender'],
      'Villain': ['villain', 'bad guy', 'evil', 'antagonist', 'enemy', 'destroyer'],
      'Anti-Hero': ['anti-hero', 'antihero', 'morally gray', 'complex', 'vigilante'],
      'Neutral': ['neutral', 'balanced', 'neither', 'independent', 'unaligned']
    };
  }

  // Automatyczne tagowanie posta na podstawie zawartości
  async autoTagPost(postData) {
    const tags = {
      universes: [],
      characters: [],
      powerTiers: [],
      categories: []
    };

    const content = `${postData.title} ${postData.content}`.toLowerCase();

    // Znajdź postaci w treści
    if (postData.fight && postData.fight.fighter1 && postData.fight.fighter2) {
      // Dla walk - użyj nazw fighterów
      const fighter1 = await Character.findOne({ name: postData.fight.fighter1 });
      const fighter2 = await Character.findOne({ name: postData.fight.fighter2 });

      if (fighter1) {
        tags.characters.push(fighter1.name);
        tags.universes.push(fighter1.universe);
        tags.powerTiers.push(fighter1.powerTier);
        tags.categories.push(fighter1.category);
      }

      if (fighter2) {
        tags.characters.push(fighter2.name);
        tags.universes.push(fighter2.universe);
        tags.powerTiers.push(fighter2.powerTier);
        tags.categories.push(fighter2.category);
      }
    } else {
      // Dla zwykłych postów - szukaj w treści
      const characters = await Character.find({ status: 'active' });
      
      for (const character of characters) {
        const characterNames = [character.name, ...character.aliases].map(name => name.toLowerCase());
        
        if (characterNames.some(name => content.includes(name))) {
          tags.characters.push(character.name);
          tags.universes.push(character.universe);
          tags.powerTiers.push(character.powerTier);
          tags.categories.push(character.category);
        }
      }
    }

    // Znajdź uniwersa na podstawie słów kluczowych
    for (const [universe, keywords] of Object.entries(this.universeKeywords)) {
      if (keywords.some(keyword => content.includes(keyword))) {
        tags.universes.push(universe);
      }
    }

    // Znajdź tier mocy na podstawie słów kluczowych
    for (const [tier, keywords] of Object.entries(this.powerTierKeywords)) {
      if (keywords.some(keyword => content.includes(keyword))) {
        tags.powerTiers.push(tier);
      }
    }

    // Znajdź kategorie na podstawie słów kluczowych
    for (const [category, keywords] of Object.entries(this.categoryKeywords)) {
      if (keywords.some(keyword => content.includes(keyword))) {
        tags.categories.push(category);
      }
    }

    // Usuń duplikaty
    tags.universes = [...new Set(tags.universes)];
    tags.characters = [...new Set(tags.characters)];
    tags.powerTiers = [...new Set(tags.powerTiers)];
    tags.categories = [...new Set(tags.categories)];

    // Stwórz główne tagi
    const mainTags = [
      ...tags.universes,
      ...tags.characters,
      ...tags.powerTiers,
      ...tags.categories
    ];

    return {
      tags: [...new Set(mainTags)],
      autoTags: tags
    };
  }

  // Aktualizuj statystyki tagów
  async updateTagStats(tagNames) {
    for (const tagName of tagNames) {
      let tag = await Tag.findOne({ name: tagName });
      
      if (!tag) {
        // Stwórz nowy tag jeśli nie istnieje
        const category = this.determineTagCategory(tagName);
        tag = new Tag({
          name: tagName,
          category: category,
          color: this.getTagColor(category)
        });
      }
      
      await tag.incrementUsage();
    }
  }

  // Określ kategorię tagu
  determineTagCategory(tagName) {
    const universes = ['DC', 'Marvel', 'Dragon Ball', 'Naruto', 'One Piece', 'Attack on Titan', 'Demon Slayer', 'JJK', 'Bleach', 'One Punch Man', 'My Hero Academia', 'Other'];
    const powerTiers = ['Regular People', 'Metahuman', 'Planet Busters', 'God Tier', 'Universal Threat', 'Omnipotent'];
    
    if (universes.includes(tagName)) return 'universe';
    if (powerTiers.includes(tagName)) return 'power_tier';
    if (['Hero', 'Villain', 'Anti-Hero', 'Neutral'].includes(tagName)) return 'genre';
    
    return 'character';
  }

  // Pobierz kolor tagu na podstawie kategorii
  getTagColor(category) {
    const colors = {
      'universe': '#007bff',
      'character': '#28a745',
      'power_tier': '#dc3545',
      'genre': '#ffc107'
    };
    
    return colors[category] || '#6c757d';
  }

  // Filtruj posty według tagów
  async filterPosts(filters = {}) {
    const query = {};
    
    if (filters.universes && filters.universes.length > 0) {
      query['autoTags.universes'] = { $in: filters.universes };
    }
    
    if (filters.characters && filters.characters.length > 0) {
      query['autoTags.characters'] = { $in: filters.characters };
    }
    
    if (filters.powerTiers && filters.powerTiers.length > 0) {
      query['autoTags.powerTiers'] = { $in: filters.powerTiers };
    }
    
    if (filters.categories && filters.categories.length > 0) {
      query['autoTags.categories'] = { $in: filters.categories };
    }
    
    if (filters.tags && filters.tags.length > 0) {
      query['tags'] = { $in: filters.tags };
    }

    if (filters.search) {
      query.$or = [
        { title: { $regex: filters.search, $options: 'i' } },
        { content: { $regex: filters.search, $options: 'i' } },
        { tags: { $regex: filters.search, $options: 'i' } },
        { 'autoTags.characters': { $regex: filters.search, $options: 'i' } }
      ];
    }

    return Post.find(query)
      .populate('authorId', 'username avatar')
      .sort({ createdAt: -1 });
  }

  // Pobierz popularne tagi
  async getPopularTags(category = null, limit = 20) {
    return Tag.getPopularTags(category, limit);
  }

  // Pobierz trending tagi
  async getTrendingTags(limit = 10) {
    return Tag.getTrendingTags(limit);
  }

  // Wyszukaj tagi
  async searchTags(query) {
    return Tag.searchTags(query);
  }

  // Inicjalizuj podstawowe tagi
  async initializeBaseTags() {
    const baseTags = [
      // Uniwersa
      { name: 'DC', category: 'universe', color: '#0078d4' },
      { name: 'Marvel', category: 'universe', color: '#ed1d24' },
      { name: 'Dragon Ball', category: 'universe', color: '#ff8c00' },
      { name: 'Naruto', category: 'universe', color: '#ff6b35' },
      { name: 'One Piece', category: 'universe', color: '#1e90ff' },
      { name: 'Attack on Titan', category: 'universe', color: '#8b4513' },
      { name: 'Demon Slayer', category: 'universe', color: '#800080' },
      { name: 'JJK', category: 'universe', color: '#000080' },
      { name: 'Bleach', category: 'universe', color: '#ff4500' },
      { name: 'One Punch Man', category: 'universe', color: '#ffd700' },
      { name: 'My Hero Academia', category: 'universe', color: '#32cd32' },

      // Tier mocy
      { name: 'Regular People', category: 'power_tier', color: '#6c757d' },
      { name: 'Metahuman', category: 'power_tier', color: '#17a2b8' },
      { name: 'Planet Busters', category: 'power_tier', color: '#ffc107' },
      { name: 'God Tier', category: 'power_tier', color: '#dc3545' },
      { name: 'Universal Threat', category: 'power_tier', color: '#6f42c1' },
      { name: 'Omnipotent', category: 'power_tier', color: '#000000' },

      // Kategorie
      { name: 'Hero', category: 'genre', color: '#28a745' },
      { name: 'Villain', category: 'genre', color: '#dc3545' },
      { name: 'Anti-Hero', category: 'genre', color: '#6c757d' },
      { name: 'Neutral', category: 'genre', color: '#17a2b8' }
    ];

    for (const tagData of baseTags) {
      const existingTag = await Tag.findOne({ name: tagData.name });
      if (!existingTag) {
        await Tag.create(tagData);
      }
    }
  }
}

export default new TaggingService();