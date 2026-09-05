import { Link, useLocation } from 'react-router-dom';
import { Code2 } from 'lucide-react';

const Navbar = () => {
  const location = useLocation();
  const path = location.pathname;

  return (
    <nav className="navbar glass">
      <div className="container nav-container">
        <Link to="/" className="nav-logo gradient-text">
          <Code2 className="inline-block mr-2" />
          Portfolio
        </Link>
        <ul className="nav-links">
          <li>
            <Link to="/" className={`nav-link ${path === '/' ? 'active' : ''}`}>
              Home
            </Link>
          </li>
          <li>
            <Link to="/projects" className={`nav-link ${path === '/projects' ? 'active' : ''}`}>
              Projects
            </Link>
          </li>
          <li>
            <Link to="/blogs" className={`nav-link ${path === '/blogs' ? 'active' : ''}`}>
              Blogs
            </Link>
          </li>
          <li>
            <Link to="/experiences" className={`nav-link ${path === '/experiences' ? 'active' : ''}`}>
              Experiences
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;
