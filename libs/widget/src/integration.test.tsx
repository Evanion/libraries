import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { createWidgets } from './widget';

// Real-world CMS components
const HeroBanner = ({
  title,
  subtitle,
  backgroundImage,
  ctaText,
  ctaLink,
}: {
  title: string;
  subtitle: string;
  backgroundImage: string;
  ctaText: string;
  ctaLink: string;
}) => (
  <section
    data-testid="hero-banner"
    className="hero-banner"
    style={{ backgroundImage: `url(${backgroundImage})` }}
  >
    <div className="hero-content">
      <h1>{title}</h1>
      <p>{subtitle}</p>
      <a href={ctaLink} className="cta-button">
        {ctaText}
      </a>
    </div>
  </section>
);

const ProductGrid = ({
  products,
  columns = 3,
}: {
  products: Array<{ id: string; name: string; price: number; image: string }>;
  columns?: number;
}) => (
  <div
    data-testid="product-grid"
    className="product-grid"
    style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
  >
    {products.map((product) => (
      <div key={product.id} className="product-card">
        <img src={product.image} alt={product.name} />
        <h3>{product.name}</h3>
        <p className="price">${product.price}</p>
      </div>
    ))}
  </div>
);

const Testimonial = ({
  quote,
  author,
  company,
  avatar,
}: {
  quote: string;
  author: string;
  company: string;
  avatar: string;
}) => (
  <blockquote data-testid="testimonial" className="testimonial">
    <p>"{quote}"</p>
    <footer>
      <img src={avatar} alt={author} />
      <div>
        <cite>{author}</cite>
        <span>{company}</span>
      </div>
    </footer>
  </blockquote>
);

const NewsletterSignup = ({
  title,
  description,
  placeholder,
  buttonText,
}: {
  title: string;
  description: string;
  placeholder: string;
  buttonText: string;
}) => (
  <div data-testid="newsletter-signup" className="newsletter-signup">
    <h3>{title}</h3>
    <p>{description}</p>
    <form>
      <input type="email" placeholder={placeholder} />
      <button type="submit">{buttonText}</button>
    </form>
  </div>
);

const ContactForm = ({
  title,
  fields,
}: {
  title: string;
  fields: Array<{
    name: string;
    type: string;
    label: string;
    required: boolean;
  }>;
}) => (
  <form data-testid="contact-form" className="contact-form">
    <h3>{title}</h3>
    {fields.map((field) => (
      <div key={field.name} className="form-field">
        <label htmlFor={field.name}>
          {field.label}
          {field.required && <span className="required">*</span>}
        </label>
        <input
          type={field.type}
          id={field.name}
          name={field.name}
          required={field.required}
        />
      </div>
    ))}
    <button type="submit">Send Message</button>
  </form>
);

describe('Widget System - CMS Integration Example', () => {
  beforeEach(() => {
    cleanup();
  });

  it('should render a complete e-commerce homepage', () => {
    // Example: Complete e-commerce homepage with multiple widget types
    const { Widgets } = createWidgets({
      components: {
        heroBanner: HeroBanner,
        productGrid: ProductGrid,
        testimonial: Testimonial,
        newsletterSignup: NewsletterSignup,
        contactForm: ContactForm,
      },
      chrome: {
        wrapper: ({ children }: { children: React.ReactNode }) => (
          <main data-testid="homepage" className="homepage">
            {children}
          </main>
        ),
        item: ({ children }: { children: React.ReactNode }) => (
          <section data-testid="widget-section" className="widget-section">
            {children}
          </section>
        ),
      },
    });

    const homepageItems = [
      {
        id: 'hero1',
        type: 'heroBanner',
        props: {
          title: 'Welcome to Our Store',
          subtitle: 'Discover amazing products at great prices',
          backgroundImage: '/hero-bg.jpg',
          ctaText: 'Shop Now',
          ctaLink: '/products',
        },
      },
      {
        id: 'products1',
        type: 'productGrid',
        props: {
          products: [
            {
              id: '1',
              name: 'Wireless Headphones',
              price: 99.99,
              image: '/headphones.jpg',
            },
            {
              id: '2',
              name: 'Smart Watch',
              price: 199.99,
              image: '/watch.jpg',
            },
            {
              id: '3',
              name: 'Laptop Stand',
              price: 49.99,
              image: '/stand.jpg',
            },
          ],
          columns: 3,
        },
      },
      {
        id: 'testimonial1',
        type: 'testimonial',
        props: {
          quote: 'This product changed my life!',
          author: 'Jane Smith',
          company: 'Tech Corp',
          avatar: '/jane.jpg',
        },
      },
      {
        id: 'newsletter1',
        type: 'newsletterSignup',
        props: {
          title: 'Stay Updated',
          description: 'Get the latest news and exclusive offers',
          placeholder: 'Enter your email',
          buttonText: 'Subscribe',
        },
      },
    ];

    render(<Widgets items={homepageItems} />);

    // Verify homepage structure
    expect(screen.getByTestId('homepage')).toBeInTheDocument();

    // Verify all widget sections are rendered
    const widgetSections = screen.getAllByTestId('widget-section');
    expect(widgetSections).toHaveLength(4);

    // Verify hero banner
    expect(screen.getByTestId('hero-banner')).toBeInTheDocument();
    expect(screen.getByText('Welcome to Our Store')).toBeInTheDocument();
    expect(
      screen.getByText('Discover amazing products at great prices')
    ).toBeInTheDocument();
    expect(screen.getByText('Shop Now')).toBeInTheDocument();

    // Verify product grid
    expect(screen.getByTestId('product-grid')).toBeInTheDocument();
    expect(screen.getByText('Wireless Headphones')).toBeInTheDocument();
    expect(screen.getByText('$99.99')).toBeInTheDocument();
    expect(screen.getByText('Smart Watch')).toBeInTheDocument();
    expect(screen.getByText('$199.99')).toBeInTheDocument();

    // Verify testimonial
    expect(screen.getByTestId('testimonial')).toBeInTheDocument();
    expect(
      screen.getByText('"This product changed my life!"')
    ).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Tech Corp')).toBeInTheDocument();

    // Verify newsletter signup
    expect(screen.getByTestId('newsletter-signup')).toBeInTheDocument();
    expect(screen.getByText('Stay Updated')).toBeInTheDocument();
    expect(
      screen.getByText('Get the latest news and exclusive offers')
    ).toBeInTheDocument();
  });

  it('should handle dynamic content updates', () => {
    // Example: CMS content that changes based on user preferences or A/B testing
    const { Widgets } = createWidgets({
      components: {
        heroBanner: HeroBanner,
        productGrid: ProductGrid,
        testimonial: Testimonial,
      },
    });

    const initialItems = [
      {
        id: 'hero1',
        type: 'heroBanner',
        props: {
          title: 'Version A',
          subtitle: 'Original design',
          backgroundImage: '/hero-a.jpg',
          ctaText: 'Learn More',
          ctaLink: '/learn',
        },
      },
    ];

    const { rerender } = render(<Widgets items={initialItems} />);

    // Verify initial content
    expect(screen.getByText('Version A')).toBeInTheDocument();
    expect(screen.getByText('Original design')).toBeInTheDocument();

    // Simulate A/B test variant
    const variantItems = [
      {
        id: 'hero1',
        type: 'heroBanner',
        props: {
          title: 'Version B',
          subtitle: 'Improved design',
          backgroundImage: '/hero-b.jpg',
          ctaText: 'Get Started',
          ctaLink: '/start',
        },
      },
    ];

    rerender(<Widgets items={variantItems} />);

    // Verify updated content
    expect(screen.getByText('Version B')).toBeInTheDocument();
    expect(screen.getByText('Improved design')).toBeInTheDocument();
    expect(screen.getByText('Get Started')).toBeInTheDocument();
    expect(screen.queryByText('Version A')).not.toBeInTheDocument();
  });

  it('should handle mixed widget types in different layouts', () => {
    // Example: Different page layouts using the same widget system
    const { Widgets } = createWidgets({
      components: {
        heroBanner: HeroBanner,
        productGrid: ProductGrid,
        testimonial: Testimonial,
        contactForm: ContactForm,
      },
    });

    // Blog layout
    const blogItems = [
      {
        id: 'hero1',
        type: 'heroBanner',
        props: {
          title: 'Blog Post Title',
          subtitle: 'A deep dive into our latest insights',
          backgroundImage: '/blog-hero.jpg',
          ctaText: 'Read More',
          ctaLink: '#content',
        },
      },
    ];

    const { rerender } = render(<Widgets items={blogItems} />);

    expect(screen.getByText('Blog Post Title')).toBeInTheDocument();
    expect(
      screen.getByText('A deep dive into our latest insights')
    ).toBeInTheDocument();

    // Contact page layout
    const contactItems = [
      {
        id: 'contact1',
        type: 'contactForm',
        props: {
          title: 'Get in Touch',
          fields: [
            { name: 'name', type: 'text', label: 'Full Name', required: true },
            {
              name: 'email',
              type: 'email',
              label: 'Email Address',
              required: true,
            },
            {
              name: 'message',
              type: 'textarea',
              label: 'Message',
              required: true,
            },
          ],
        },
      },
    ];

    rerender(<Widgets items={contactItems} />);

    expect(screen.getByText('Get in Touch')).toBeInTheDocument();
    expect(screen.getByLabelText(/Full Name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email Address/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Message/)).toBeInTheDocument();
    expect(screen.getByText('Send Message')).toBeInTheDocument();
  });

  it('should handle complex nested data structures', () => {
    // Example: Complex CMS data with nested objects and arrays
    const { Widgets } = createWidgets({
      components: {
        productGrid: ProductGrid,
        testimonial: Testimonial,
      },
    });

    const complexItems = [
      {
        id: 'products1',
        type: 'productGrid',
        props: {
          products: [
            {
              id: '1',
              name: 'Premium Headphones',
              price: 299.99,
              image: '/premium-headphones.jpg',
            },
            {
              id: '2',
              name: 'Gaming Mouse',
              price: 79.99,
              image: '/gaming-mouse.jpg',
            },
            {
              id: '3',
              name: 'Mechanical Keyboard',
              price: 149.99,
              image: '/keyboard.jpg',
            },
            {
              id: '4',
              name: 'Monitor Stand',
              price: 89.99,
              image: '/monitor-stand.jpg',
            },
          ],
          columns: 2,
        },
      },
      {
        id: 'testimonial1',
        type: 'testimonial',
        props: {
          quote:
            'The quality is outstanding and the customer service is excellent!',
          author: 'Michael Johnson',
          company: 'Design Studio Inc.',
          avatar: '/michael.jpg',
        },
      },
    ];

    render(<Widgets items={complexItems} />);

    // Verify product grid with complex data
    expect(screen.getByTestId('product-grid')).toBeInTheDocument();
    expect(screen.getByText('Premium Headphones')).toBeInTheDocument();
    expect(screen.getByText('$299.99')).toBeInTheDocument();
    expect(screen.getByText('Gaming Mouse')).toBeInTheDocument();
    expect(screen.getByText('$79.99')).toBeInTheDocument();

    // Verify testimonial with complex data
    expect(screen.getByTestId('testimonial')).toBeInTheDocument();
    expect(
      screen.getByText(
        '"The quality is outstanding and the customer service is excellent!"'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Michael Johnson')).toBeInTheDocument();
    expect(screen.getByText('Design Studio Inc.')).toBeInTheDocument();
  });
});
