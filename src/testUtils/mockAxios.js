export const createMockAxios = () => {
  const buildMockResponse = (url = '', method = 'get') => {
    const safeUrl = String(url);
    if (safeUrl.includes('/api/tags/filter-posts')) {
      return { data: { posts: [], count: 0 } };
    }
    if (safeUrl.includes('/api/posts?')) {
      return { data: { posts: [], count: 0 } };
    }
    if (safeUrl.includes('/api/posts/user/')) {
      return { data: [] };
    }
    if (safeUrl.includes('/api/posts/')) {
      return {
        data: {
          id: 'mock-post',
          title: 'Mock Post',
          content: '',
          author: {},
          reactions: [],
          reactionsSummary: [],
          fight: null
        }
      };
    }
    if (safeUrl.includes('/api/comments/post/')) {
      return { data: [] };
    }
    if (safeUrl.includes('/api/comments/user/')) {
      return { data: [] };
    }
    if (safeUrl.includes('/api/profile')) {
      return { data: { id: 'mock-user', username: 'mock', profile: {}, description: '' } };
    }
    if (safeUrl.includes('/api/characters')) {
      return { data: [] };
    }
    if (safeUrl.includes('/api/divisions')) {
      return { data: [] };
    }
    if (method === 'post') {
      return { data: {} };
    }
    return { data: {} };
  };

  const mockAxios = {
    get: jest.fn((url) => Promise.resolve(buildMockResponse(url, 'get'))),
    post: jest.fn((url) => Promise.resolve(buildMockResponse(url, 'post'))),
    put: jest.fn((url) => Promise.resolve(buildMockResponse(url, 'put'))),
    delete: jest.fn((url) => Promise.resolve(buildMockResponse(url, 'delete'))),
    create: jest.fn(),
    interceptors: {
      request: {
        use: jest.fn(),
        eject: jest.fn()
      },
      response: {
        use: jest.fn(),
        eject: jest.fn()
      }
    },
    defaults: {
      headers: {
        common: {}
      }
    }
  };

  mockAxios.create.mockImplementation(() => mockAxios);

  return mockAxios;
};
