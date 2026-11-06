## 0.2.0 (2026-11-06)

### 🚀 Features

- **acl:** export the rule types the typed fields() overloads name ([8e4bd9df](https://github.com/Evanion/libraries/commit/8e4bd9df))
- **acl:** `validateAll` lists every validation issue without throwing ([#542](https://github.com/Evanion/libraries/issues/542))
- **acl:** validate typed field paths one entry at a time ([843364e7](https://github.com/Evanion/libraries/commit/843364e7))
- ⚠️  **acl:** type the field paths a typed policy may name ([b5b18c17](https://github.com/Evanion/libraries/commit/b5b18c17))
- **acl:** compare nested field lists in `diffMatrix` ([3b2bc820](https://github.com/Evanion/libraries/commit/3b2bc820))
- ⚠️  **acl:** field rules name nested paths ([54c10df9](https://github.com/Evanion/libraries/commit/54c10df9))
- **acl:** add `canEach` for one permission over many subjects ([59013db4](https://github.com/Evanion/libraries/commit/59013db4))
- **acl:** explain reports every condition behind a decision ([#543](https://github.com/Evanion/libraries/issues/543))

### 🩹 Fixes

- **acl:** name an empty config key as fields[""] in errors ([f44ea8f0](https://github.com/Evanion/libraries/commit/f44ea8f0))
- ⚠️  **acl:** refuse arrays a rule indexes into and prototype steps in raw write keys ([7f465783](https://github.com/Evanion/libraries/commit/7f465783))
- **acl:** read a bracketed dotted key under the path it spells ([33805a8b](https://github.com/Evanion/libraries/commit/33805a8b))
- **acl:** keep a column's config deciding its listed dotted write ([c796a73d](https://github.com/Evanion/libraries/commit/c796a73d))
- **acl:** write a flat dotted column its escaped entry allows ([945913c5](https://github.com/Evanion/libraries/commit/945913c5))
- **acl:** gate a dotted key before descending into it on read ([96fe533f](https://github.com/Evanion/libraries/commit/96fe533f))
- **acl:** deny a dotted key that holds a ruled subtree on read ([c184b666](https://github.com/Evanion/libraries/commit/c184b666))
- **acl:** let a path rule only tighten a dotted key on read ([9357b6ef](https://github.com/Evanion/libraries/commit/9357b6ef))
- **acl:** read a dotted key under the path it spells ([0f8f819d](https://github.com/Evanion/libraries/commit/0f8f819d))
- **acl:** keep `validateAll` in step with `hydratePolicy` ([a8ff905f](https://github.com/Evanion/libraries/commit/a8ff905f))
- **acl:** check the literal prefix of a template field path ([b9c53df9](https://github.com/Evanion/libraries/commit/b9c53df9))
- **acl:** close the typed field path gaps for templates and optional objects ([325562a6](https://github.com/Evanion/libraries/commit/325562a6))
- **acl:** report opaque field changes in `diffMatrix` ([ac988064](https://github.com/Evanion/libraries/commit/ac988064))
- **acl:** name the permission in a deny without a baseline ([e0cc1880](https://github.com/Evanion/libraries/commit/e0cc1880))

### 💅 Refactors

- **acl:** read each permission once while collecting issues ([b620ab42](https://github.com/Evanion/libraries/commit/b620ab42))
- **acl:** keep issue collection total over hostile documents ([b9a5dbe7](https://github.com/Evanion/libraries/commit/b9a5dbe7))
- **acl:** keep issue messages total over any value ([4184a9a1](https://github.com/Evanion/libraries/commit/4184a9a1))
- **acl:** collect validation issues in one pass ([fc9f1f52](https://github.com/Evanion/libraries/commit/fc9f1f52))
- **acl:** refuse dotted keys that leave the rule tree ([2017145b](https://github.com/Evanion/libraries/commit/2017145b))
- **acl:** snapshot walked levels and refuse path-shaped write keys ([0d752696](https://github.com/Evanion/libraries/commit/0d752696))
- **acl:** close the field walk's flat-parity and write-replace gaps ([0b4df178](https://github.com/Evanion/libraries/commit/0b4df178))
- **acl:** walk nested field paths in the field decision ([b782d399](https://github.com/Evanion/libraries/commit/b782d399))
- **acl:** take the subject out of the shared gate ([99618f93](https://github.com/Evanion/libraries/commit/99618f93))
- **acl:** share the decision gates between can and explain ([32c71360](https://github.com/Evanion/libraries/commit/32c71360))
- **acl:** add the field path codec ([62e4a769](https://github.com/Evanion/libraries/commit/62e4a769))

### 📖 Documentation

- **acl:** finish the nested-path guide ([db4f9d8c](https://github.com/Evanion/libraries/commit/db4f9d8c))
- **acl:** name the column a dotted write may touch ([5159e22d](https://github.com/Evanion/libraries/commit/5159e22d))
- **acl:** keep dotted-column writes from being lost ([743b189d](https://github.com/Evanion/libraries/commit/743b189d))
- **acl:** show how dotted columns are decided ([94258cf3](https://github.com/Evanion/libraries/commit/94258cf3))
- **acl:** correct the nested write and plain-row guidance ([7b09e9ee](https://github.com/Evanion/libraries/commit/7b09e9ee))
- **acl:** nested field paths ([d73c7992](https://github.com/Evanion/libraries/commit/d73c7992))
- **acl:** scope the prototype-key guarantees to the walked levels ([fa9fbffc](https://github.com/Evanion/libraries/commit/fa9fbffc))
- **acl:** state the raw dotted-column leak and depth in the register ([10b11c59](https://github.com/Evanion/libraries/commit/10b11c59))

### ⚠️  Breaking Changes

- **acl:** refuse arrays a rule indexes into and prototype steps in raw write keys  ([7f465783](https://github.com/Evanion/libraries/commit/7f465783))
  a raw key containing `.` is also read as the path it
  spells, so an exclusion on that path denies it on read (`not-listed`) and
  on write (`not-traversable`). For example `{ 'a.b': 1 }` under
  `['*', '!a']` was allowed in 0.1.2 and is now denied. An allow entry
  naming the escaped key (`'a\\.b'`) decides the flat column on read, and
  makes it writable when nothing restricts its path. An array a rule
  indexes into (`!items.0.price`) is refused `not-traversable`. A raw write
  key with a `constructor` or `prototype` segment is refused.
- **acl:** type the field paths a typed policy may name  ([b5b18c17](https://github.com/Evanion/libraries/commit/b5b18c17))
  the typed builder's `.fields()` now refuses a name its
  object type does not have. The untyped builder and `hydratePolicy` still take
  any string.
- **acl:** field rules name nested paths  ([54c10df9](https://github.com/Evanion/libraries/commit/54c10df9))
  a flat key containing "." or "\" is keyed in the decision
  maps by its escaped path ("a\.b"). The field reason "not-traversable" is
  new, so an exhaustive switch over FieldReason needs the arm. Construction
  refuses lists it accepted before: a "!path" with no "*" or listed ancestor
  (for example ["id", "!address.street"]), an entry beside its own exclusion,
  an allow below an excluded path, a targets/transitions key with another
  rule below it, a path with an empty, "__proto__", "*" or "!"-leading
  segment, a path of more than 32 segments, the plain list entries
  ["__proto__"] and ["!*"], and the config keys "*", "!a", "__proto__" and
  "". BangInAllowListError is removed; the missing-baseline
  case raises DenyWithoutBaselineError. Path-shaped raw write keys ("[", "]",
  unclean dotted splits, dotted keys that leave the rule tree under nested
  rules) are refused on the write axis. A write that would replace a stored
  subtree holding a key the caller may not write is refused with
  "not-traversable". An evaluator reading a 0.2 document must run 0.1.2 or
  later.

### ❤️ Thank You

- Mikael Pettersson @Evanion

## 0.1.2 (2026-11-06)

### 🩹 Fixes

- **acl:** tighten the dotted-entry tests and comments ([eb7dcf3a](https://github.com/Evanion/libraries/commit/eb7dcf3a))
- **acl:** refuse dotted field-rule entries at construction ([ae87b8e2](https://github.com/Evanion/libraries/commit/ae87b8e2))
- **acl:** length-prefix the parts of a derived rule id ([#285](https://github.com/Evanion/libraries/issues/285))
- **docs:** show the server half on the authorization page and tighten its copy ([298087a4](https://github.com/Evanion/libraries/commit/298087a4))

### 📖 Documentation

- **acl:** add the service callers and delegation guide ([66302a3e](https://github.com/Evanion/libraries/commit/66302a3e))
- **acl:** add the filtering what a user sees guide ([df69d19f](https://github.com/Evanion/libraries/commit/df69d19f))
- **repo:** link the documentation at libs.evanion.com/docs ([dc18dbb2](https://github.com/Evanion/libraries/commit/dc18dbb2))

### ❤️ Thank You

- Mikael Pettersson @Evanion

## 0.1.1 (2026-10-18)

### 🩹 Fixes

- **acl:** seal a frozen matrix's Date, Map and Set mutators ([9a18424c](https://github.com/Evanion/libraries/commit/9a18424c))

### ❤️ Thank You

- Mikael Pettersson @Evanion