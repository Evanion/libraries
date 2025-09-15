'use client';

import { useState } from 'react';
import WidgetPlayground from './WidgetPlayground';

const examples = {
  basic: {
    title: 'Basic Widget System',
    code: `const NewsTeaser = ({ title, publishedAt, body }) => (
  <article className="border border-gray-300 dark:border-gray-600 p-4 my-2 rounded-lg bg-white dark:bg-gray-800">
    <h3 className="mb-2 text-gray-900 dark:text-gray-100 font-semibold">{title}</h3>
    <time className="text-gray-600 dark:text-gray-400 text-sm">
      {publishedAt.toLocaleDateString()}
    </time>
    <p className="mt-2 text-gray-700 dark:text-gray-300">{body}</p>
  </article>
);

const UserSidebar = ({ username, avatar, messages }) => (
  <div className="flex items-center p-3 border border-gray-300 dark:border-gray-600 rounded-lg my-2 bg-white dark:bg-gray-800">
    <img 
      src={avatar} 
      alt={username}
      className="w-10 h-10 rounded-full mr-3"
    />
    <div>
      <div className="font-bold text-gray-900 dark:text-gray-100">{username}</div>
      <div className="text-sm text-gray-600 dark:text-gray-400">
        {messages} messages
      </div>
    </div>
  </div>
);

const { Widgets } = createWidgets({
  components: {
    news: NewsTeaser,
    userInfo: UserSidebar,
  },
});

const items = [
  {
    id: 'userinfo',
    type: 'userInfo',
    props: {
      username: 'Evanion',
      avatar: 'https://via.placeholder.com/40',
      messages: 5,
    },
    children: [],
  },
  {
    id: 'news1',
    type: 'news',
    props: {
      title: 'Breaking News',
      publishedAt: new Date(),
      body: 'Try editing this text to see the widget update!',
    },
    children: [],
  },
];

render(<Widgets items={items} />)`,
  },

  ecommerce: {
    title: 'E-commerce Showcase',
    code: `const ProductCard = ({ name, price, image }: { name: string; price: number; image: string }) => (
  <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-white dark:bg-gray-800 m-2 max-w-xs text-center">
    <img 
      src={image} 
      alt={name}
      className="w-full h-30 object-cover rounded mb-3"
    />
    <h4 className="mb-2 text-gray-900 dark:text-gray-100 font-semibold">{name}</h4>
    <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
      {'$' + price}
    </p>
  </div>
);

const Banner = ({ title, cta }: { title: string; cta: string }) => (
  <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-10 rounded-lg text-center my-2">
    <h2 className="mb-4 text-2xl font-bold">{title}</h2>
    <button className="bg-white text-blue-600 border-none px-6 py-3 rounded-md text-base font-bold cursor-pointer hover:bg-gray-100 transition-colors">
      {cta}
    </button>
  </div>
);

const { Widgets } = createWidgets({
  components: {
    productCard: ProductCard,
    banner: Banner,
  },
  chrome: {
    wrapper: ({ children }) => (
      <div className="p-5 bg-gray-50 dark:bg-gray-900 rounded-lg">
        <header className="text-center mb-5 text-2xl font-bold text-gray-900 dark:text-gray-100">
          Featured Products
        </header>
        <div className="flex flex-wrap justify-center gap-2">
          {children}
        </div>
      </div>
    ),
  },
});

const items = [
  {
    id: 'banner1',
    type: 'banner',
    props: {
      title: 'Summer Sale',
      cta: 'Shop Now',
    },
    children: [],
  },
  {
    id: 'product1',
    type: 'productCard',
    props: {
      name: 'Wireless Headphones',
      price: 99.99,
      image: 'https://via.placeholder.com/200x120',
    },
    children: [],
  },
  {
    id: 'product2',
    type: 'productCard',
    props: {
      name: 'Smart Watch',
      price: 199.99,
      image: 'https://via.placeholder.com/200x120',
    },
    children: [],
  },
];

render(<Widgets items={items} />)`,
  },

  dashboard: {
    title: 'Dashboard with Statistics',
    code: `const StatCard = ({ title, value, trend }: { title: string; value: string; trend: string }) => (
  <div className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 m-2 min-w-48 text-center">
    <h4 className="mb-2 text-gray-900 dark:text-gray-100 font-semibold">{title}</h4>
    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
      {value}
    </div>
    <div className="text-sm text-green-600 dark:text-green-400">{trend}</div>
  </div>
);

const ActionButton = ({ label, variant }: { label: string; variant: string }) => (
  <button className={\`\${variant === 'primary' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-600 hover:bg-gray-700'} text-white border-none px-6 py-3 rounded-md text-base font-bold cursor-pointer m-2 transition-colors\`}>
    {label}
  </button>
);

const { Widgets } = createWidgets({
  components: {
    statCard: StatCard,
    actionButton: ActionButton,
  },
  chrome: {
    wrapper: ({ children }) => (
      <div className="p-5 bg-gray-50 dark:bg-gray-900 rounded-lg">
        <h2 className="text-center mb-5 text-xl font-bold text-gray-900 dark:text-gray-100">
          Admin Dashboard
        </h2>
        <div className="flex flex-wrap justify-center gap-2">
          {children}
        </div>
      </div>
    ),
  },
});

const items = [
  {
    id: 'stats1',
    type: 'statCard',
    props: {
      title: 'Total Users',
      value: '1,234',
      trend: '+12%',
    },
    children: [],
  },
  {
    id: 'stats2',
    type: 'statCard',
    props: {
      title: 'Revenue',
      value: '$45,678',
      trend: '+8%',
    },
    children: [],
  },
  {
    id: 'action1',
    type: 'actionButton',
    props: {
      label: 'Export Data',
      variant: 'primary',
    },
    children: [],
  },
];

render(<Widgets items={items} />)`,
  },
};

export default function PlaygroundExamples() {
  const [selectedExample, setSelectedExample] =
    useState<keyof typeof examples>('basic');

  return (
    <div className="playground-examples">
      <div className="examples-header">
        <h3>Try These Examples</h3>
        <div className="example-tabs">
          {Object.entries(examples).map(([key, example]) => (
            <button
              key={key}
              className={`example-tab ${
                selectedExample === key ? 'active' : ''
              }`}
              onClick={() => setSelectedExample(key as keyof typeof examples)}
            >
              {example.title}
            </button>
          ))}
        </div>
      </div>

      <WidgetPlayground
        initialCode={examples[selectedExample].code}
        height={500}
      />
    </div>
  );
}
