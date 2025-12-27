import React from 'react';

let mockParams = {};
let mockSearchParams = new URLSearchParams();

export const __setMockParams = (params = {}) => {
  mockParams = params;
};

export const __setMockSearchParams = (params = {}) => {
  mockSearchParams = new URLSearchParams(params);
};

export const useParams = () => mockParams;
export const useNavigate = () => jest.fn();
export const useSearchParams = () => [mockSearchParams, jest.fn()];

export const Link = ({ to, children, ...rest }) => (
  <a href={typeof to === 'string' ? to : '/'} {...rest}>
    {children}
  </a>
);

export const BrowserRouter = ({ children }) => <div>{children}</div>;
export const MemoryRouter = ({ children }) => <div>{children}</div>;
export const Routes = ({ children }) => <>{children}</>;
export const Route = () => null;
export const Navigate = () => null;
