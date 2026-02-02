import React from 'react';
import { Link } from 'react-router-dom';
import { CCG_BASE_PATH } from '../utils/paths';

const Navbar = ({ user }) => (
  <nav className="space-nav">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex justify-end h-16">
        <div className="flex items-center space-x-4">
          {user && (
            <>
              <div className="hidden md:block mr-4 text-sm text-gray-300 uppercase tracking-wide">
                Witaj, <span className="font-semibold text-gray-100">{user.username}</span>
              </div>
              <Link
                to={`${CCG_BASE_PATH}/lobby`}
                className="space-nav-item"
              >
                Lobby
              </Link>
              <Link
                to={`${CCG_BASE_PATH}/collection`}
                className="space-nav-item"
              >
                Kolekcja
              </Link>
              <Link
                to={`${CCG_BASE_PATH}/decks`}
                className="space-nav-item"
              >
                Talie
              </Link>
              <Link
                to={`${CCG_BASE_PATH}/shop`}
                className="space-nav-item"
              >
                Sklep
              </Link>
              <Link
                to={`${CCG_BASE_PATH}/crafting`}
                className="space-nav-item"
              >
                Crafting
              </Link>
              <Link
                to={`${CCG_BASE_PATH}/profile`}
                className="space-nav-item"
              >
                Profil
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  </nav>
);

export default Navbar;
