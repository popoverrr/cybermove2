import React from 'react';
import { AbsoluteFill, Composition, staticFile } from 'remotion';
import { loadFont } from '@remotion/fonts';
import { Frame } from './Frame';
import { FPS, LOOP } from './kit';
import { SCENES } from './scenes3d';

loadFont({ family: 'CMMono', url: staticFile('fonts/mono.woff2'), weight: '100 800' });
loadFont({ family: 'CMTight', url: staticFile('fonts/tight.woff2'), weight: '100 900' });

const make = (variant: 'card' | 'hero', i: number) => {
  const s = SCENES[i];
  const Comp: React.FC = () => (
    <AbsoluteFill style={{ backgroundColor: '#08090B' }}>
      <s.Scene />
      <Frame variant={variant} index={s.index} code={s.code} readouts={s.readouts} overlay>{null}</Frame>
    </AbsoluteFill>
  );
  return Comp;
};

export const RemotionRoot: React.FC = () => (
  <>
    {SCENES.map((s, i) => (
      <React.Fragment key={s.id}>
        <Composition id={`card-${s.id}`} component={make('card', i)} durationInFrames={LOOP + 1} fps={FPS} width={1080} height={1350} />
        <Composition id={`hero-${s.id}`} component={make('hero', i)} durationInFrames={LOOP + 1} fps={FPS} width={1920} height={1080} />
      </React.Fragment>
    ))}
  </>
);
