# @evanion/react-acl

**Context-aware authorization hooks for your React component tree.**

Stop prop-drilling authorization decisions through ten layers of components just to hide a single button. `@evanion/react-acl` provides a set of high-performance hooks that allow any component in your tree to ask, "Can the current user perform this action on this object?" without needing to know where the user or the policy lives.

## The Problem: The "Authorization Prop-Drill"

In most React apps, authorization is handled by passing a `user` object or a `permissions` array down from the root. This leads to:
1. **Prop-Drilling**: Passing authorization data through components that don't need it, just to reach a leaf component that does.
2. **Fragile UI Logic**: Spreading `if (user.role === 'admin')` checks throughout your JSX, making it nearly impossible to change your permission model without editing every single component.
3. **Sync Issues**: Ensuring that every component has the freshest version of the user's permissions, especially after a role change or session update.

## The Solution: Policy-Driven Hooks

`@evanion/react-acl` brings the power of `@evanion/acl`'s serializable matrices directly into your React components. Instead of checking roles, you check **capabilities**.

You wrap your app (or a sub-tree) in a `PolicyProvider`, and any child component can then use the `useCan` hook to make a decision.

### Core Concept: Declarative UI Gating

```tsx @import.meta.vitest
import { useCan } from '@evanion/react-acl';

function EditControl({ listing }) {
  // Ask the policy: "Can the current user edit this listing?"
  const { allowed } = useCan('listing', 'edit', listing);

  if (!allowed) return null;

  return <button>Edit listing</button>;
}
```

### Why this is better:
- 🧩 **Zero Prop-Drilling**: Components ask for what they need, when they need it.
- 🎯 **Decoupled Logic**: The component doesn't know *why* it's allowed (e.g., because it's an admin or the owner); it only knows *if* it's allowed.
- ⚡ **High Performance**: Decisions are evaluated locally using a frozen matrix, ensuring that UI toggles never trigger network requests.
- 🛠️ **Type-Safe**: When used with `createPolicyContext`, your permission keys and object types are checked at compile time.

## Installation

```bash
npm install @evanion/react-acl @evanion/acl
```

## Important: Advisory vs. Authoritative (Security Contract)
+
+ It is critical to remember that **browser-side authorization is advisory**. 
+
+ Hiding a button in React does not protect the data behind it. A user can always trigger the API request manually. Therefore, while `@evanion/react-acl` is perfect for a polished UI, you **must** perform the same check on your server using `@evanion/acl` before executing any write or sensitive read.
+
+ This follows the core **security contract** defined in the main `@evanion/acl` package.

## Beyond the Basics

Authorization in complex UIs often requires more than a simple boolean. Our documentation covers advanced patterns, including:

- **`useCanMany`**: Efficiently evaluate permissions for a list of objects (e.g., a data table) without triggering N separate hook calls.
- **`useCanFields`**: Control exactly which fields a user can edit in a form.
- **`useCapabilities`**: Generate a full map of a user's permissions to build dynamic navigation menus.
- **Policy Contexts**: Creating type-safe wrappers for your specific domain model.

For the full API reference and integration guides, visit our documentation site:

👉 **[docs.evanion.com/react-acl](https://docs.evanion.com/react-acl)**

## License
MIT
