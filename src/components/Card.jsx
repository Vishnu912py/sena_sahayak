const Card = ({ title, description, image, tags, link }) => {
  return (
    <a href={link} className="card glass animate-fade-in" target="_blank" rel="noopener noreferrer">
      {image && <img src={image} alt={title} className="card-img" />}
      <div className="card-content">
        <h3 className="card-title">{title}</h3>
        <p className="card-desc">{description}</p>
        {tags && (
          <div className="card-tags">
            {tags.map((tag, index) => (
              <span key={index} className="card-tag">{tag}</span>
            ))}
          </div>
        )}
      </div>
    </a>
  );
};

export default Card;
