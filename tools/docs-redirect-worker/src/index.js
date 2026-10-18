import { target } from './redirect.js';

export default {
  fetch(request) {
    return Response.redirect(target(new URL(request.url)), 301);
  },
};
