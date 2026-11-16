export default ({ mode }) => ({
  base: mode === 'ios' ? '/' : '/practice/',
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        intonation: 'intonation.html',
      },
    },
  },
});
