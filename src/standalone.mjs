import React from 'react';
import { createRoot } from 'react-dom/client';
import { registerAutobotCommandCenter } from './plugin.mjs';

window.__ACC_BASE_PATH__ = '/';
window.__ACC_STANDALONE__ = true;
window.__ACC_HIVEMIND_API__ = '/api/hivemind';

window.__HERMES_PLUGIN_SDK__ = {
  React,
  hooks: {
    useState: React.useState,
    useEffect: React.useEffect,
    useMemo: React.useMemo,
    useCallback: React.useCallback,
    useRef: React.useRef,
    useContext: React.useContext,
    createContext: React.createContext,
  },
};
window.__HERMES_PLUGINS__ = {
  register(name, Component) {
    if (name !== 'autobot-command-center') throw new Error(`Unexpected plugin registration: ${name}`);
    const root = document.getElementById('acc-root');
    if (!root) throw new Error('ACC root element is missing');
    createRoot(root).render(React.createElement(Component));
  },
};

registerAutobotCommandCenter();
