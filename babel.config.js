module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // react-native-worklets/plugin must be listed LAST.
    // (Reanimated 4 moved its plugin from react-native-reanimated/plugin
    //  to react-native-worklets/plugin.)
    plugins: ['react-native-worklets/plugin'],
  };
};
