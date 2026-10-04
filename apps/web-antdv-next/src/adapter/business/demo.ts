// This public build flag changes the demo UI only. Server permissions enforce
// read-only access; never put private credentials in a VITE_* variable.
export const isPublicDemo = import.meta.env.VITE_PUBLIC_DEMO === 'true';
