import { Mail, Globe, MapPin } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="container footer-content">
        <div className="social-links">
          <a href="#" target="_blank" rel="noopener noreferrer"><Globe /></a>
          <a href="#" target="_blank" rel="noopener noreferrer"><MapPin /></a>
          <a href="#" target="_blank" rel="noopener noreferrer"><Mail /></a>
        </div>
        <p className="nav-link">&copy; {new Date().getFullYear()} My Portfolio. Built with React.</p>
      </div>
    </footer>
  );
};

export default Footer;
