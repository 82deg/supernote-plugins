// Border editor. Preview on top; below it a menu on the left (Type, then the
// settings for a line or for tape, each showing its current value) and the
// options for the selected section on the right. Patterns are grouped (Basics,
// Geometric, Nature, Fun) and paged rather than scrolled. E-ink: black on white,
// inverted selection, 48 dp+ targets, no animation; redraws only on taps.
import React, {useMemo, useState} from 'react';
import {PixelRatio, Pressable, StyleSheet, Text, View, type LayoutChangeEvent} from 'react-native';
import type {Size} from '../note/geometry';
import {croppedPlacement} from '../image/crop';
import {cornerRadius} from '../image/corners';
import {stageLayout} from '../image/transform';
import {
  frameLayout,
  LINE_STYLES,
  LINE_WIDTHS,
  sameBorder,
  TAPE_GROUPS,
  TAPE_PATTERNS,
  TAPE_PLACEMENTS,
  TAPE_WIDTHS,
  TONES,
  type Border,
  type TapeGroup,
  type TapePlacement,
} from '../image/border';
import FramedPicture, {TAPE_BASE, TILE_DP, TileFill, tapeTile} from '../image/FramedPicture';
import type {BorderJob, Source} from '../note/lassoPicture';

type Kind = Border['kind'];
type Line = Extract<Border, {kind: 'line'}>;
type Tape = Extract<Border, {kind: 'tape'}>;
type Section = 'type' | 'style' | 'width' | 'colour' | 'pattern' | 'tapeWidth' | 'place';

const DEFAULT_LINE: Line = {kind: 'line', style: 'solid', width: 'med', tone: 'black'};
const DEFAULT_TAPE: Tape = {kind: 'tape', pattern: 'stripes', width: 'slim', placement: 'topCorners'};
const KINDS: {id: Kind; label: string; hint: string}[] = [
  {id: 'none', label: 'None', hint: 'Just the picture'},
  {id: 'line', label: 'Line', hint: 'Solid, dashed or dotted'},
  {id: 'tape', label: 'Tape', hint: 'Washi tape strips'},
];
const PER_PAGE = 12; // 4 × 3 pattern swatches
const label = <T extends string>(list: {id: T; label: string}[], id: T) => list.find(x => x.id === id)?.label ?? '';
const groupOf = (p: Tape['pattern']) => TAPE_PATTERNS.find(x => x.id === p)?.group ?? 'basics';

interface Props {
  job: BorderJob;
  onDone: (border: Border) => void;
  onCancel: () => void;
}

export default function BorderScreen({job, onDone, onCancel}: Props): React.JSX.Element {
  const {start, src} = job;
  const [kind, setKind] = useState<Kind>(start.kind);
  const [line, setLine] = useState<Line>(start.kind === 'line' ? start : DEFAULT_LINE);
  const [tape, setTape] = useState<Tape>(start.kind === 'tape' ? start : DEFAULT_TAPE);
  const [section, setSection] = useState<Section>(start.kind === 'tape' ? 'pattern' : start.kind === 'line' ? 'style' : 'type');
  const [group, setGroup] = useState<TapeGroup>(groupOf(tape.pattern));
  const [page, setPage] = useState(() => {
    const inGroup = TAPE_PATTERNS.filter(p => p.group === groupOf(tape.pattern));
    return Math.floor(Math.max(0, inGroup.findIndex(p => p.id === tape.pattern)) / PER_PAGE);
  });
  const [area, setArea] = useState<Size | null>(null);

  const border = useMemo<Border>(
    () => (kind === 'line' ? line : kind === 'tape' ? tape : {kind: 'none'}),
    [kind, line, tape],
  );
  const changed = !sameBorder(border, src.border);
  const preview = useMemo(() => (area ? previewLayout(src, border, area) : null), [src, border, area]);

  const menu: {id: Section; label: string; value: string}[] = [
    {id: 'type', label: 'Type', value: label(KINDS, kind)},
    ...(kind === 'line'
      ? [
          {id: 'style' as const, label: 'Style', value: label(LINE_STYLES, line.style)},
          {id: 'width' as const, label: 'Width', value: label(LINE_WIDTHS, line.width)},
          {id: 'colour' as const, label: 'Colour', value: label(TONES, line.tone)},
        ]
      : []),
    ...(kind === 'tape'
      ? [
          {id: 'pattern' as const, label: 'Pattern', value: label(TAPE_PATTERNS, tape.pattern)},
          {id: 'tapeWidth' as const, label: 'Width', value: label(TAPE_WIDTHS, tape.width)},
          {id: 'place' as const, label: 'Place', value: label(TAPE_PLACEMENTS, tape.placement)},
        ]
      : []),
  ];

  const pickKind = (k: Kind) => {
    setKind(k);
    if (k === 'line') {
      setSection('style');
    } else if (k === 'tape') {
      setSection('pattern');
    }
  };

  const onLayout = (e: LayoutChangeEvent) => {
    const {width, height} = e.nativeEvent.layout;
    setArea({width, height});
  };

  const patterns = TAPE_PATTERNS.filter(p => p.group === group);
  const pages = Math.max(1, Math.ceil(patterns.length / PER_PAGE));
  const shown = patterns.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <Pressable style={styles.textBtn} onPress={onCancel} accessibilityRole="button">
          <Text style={styles.textBtnLabel}>Cancel</Text>
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          Border
        </Text>
        <Pressable
          style={[styles.textBtn, styles.textBtnRight]}
          onPress={() => pickKind('none')}
          disabled={kind === 'none'}
          accessibilityRole="button"
          accessibilityLabel="Remove the border">
          <Text style={[styles.textBtnLabel, kind === 'none' && styles.disabledLabel]}>Reset</Text>
        </Pressable>
      </View>

      <View style={styles.preview} onLayout={onLayout}>
        {preview ? (
          <FramedPicture layout={preview.layout} path={src.path} radius={preview.radius} frame={preview.frame} />
        ) : null}
      </View>

      <View style={styles.editor}>
        <View style={styles.menu} accessibilityRole="tablist">
          {menu.map(m => {
            const on = m.id === section;
            return (
              <Pressable
                key={m.id}
                style={[styles.menuItem, on && styles.menuItemOn]}
                onPress={() => setSection(m.id)}
                accessibilityRole="tab"
                accessibilityState={{selected: on}}
                accessibilityLabel={`${m.label}: ${m.value}`}>
                <Text style={[styles.menuLabel, on && styles.onText]}>{m.label}</Text>
                <Text style={[styles.menuValue, on && styles.onText]} numberOfLines={1}>
                  {m.value}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.panel}>
          {section === 'type'
            ? KINDS.map(k => (
                <Option key={k.id} on={kind === k.id} onPress={() => pickKind(k.id)} label={k.label} hint={k.hint} />
              ))
            : null}

          {section === 'style'
            ? LINE_STYLES.map(s => (
                <Option
                  key={s.id}
                  on={line.style === s.id}
                  onPress={() => setLine({...line, style: s.id})}
                  label={s.label}
                  visual={on => <LineSample style={s.id} thickness={4} color={on ? '#fff' : '#000'} />}
                />
              ))
            : null}

          {section === 'width'
            ? LINE_WIDTHS.map((w, i) => (
                <Option
                  key={w.id}
                  on={line.width === w.id}
                  onPress={() => setLine({...line, width: w.id})}
                  label={w.label}
                  visual={on => <LineSample style="solid" thickness={[2, 4, 7][i]} color={on ? '#fff' : '#000'} />}
                />
              ))
            : null}

          {section === 'colour'
            ? TONES.map(t => (
                <Option
                  key={t.id}
                  on={line.tone === t.id}
                  onPress={() => setLine({...line, tone: t.id})}
                  label={t.label}
                  visual={on => <View style={[styles.toneDot, {backgroundColor: t.color}, on && styles.toneDotOn]} />}
                />
              ))
            : null}

          {section === 'pattern' ? (
            <>
              <View style={styles.groups} accessibilityRole="tablist">
                {TAPE_GROUPS.map(g => {
                  const on = g.id === group;
                  return (
                    <Pressable
                      key={g.id}
                      style={[styles.chip, on && styles.chipOn]}
                      onPress={() => {
                        setGroup(g.id);
                        setPage(0);
                      }}
                      accessibilityRole="tab"
                      accessibilityState={{selected: on}}>
                      <Text style={[styles.chipLabel, on && styles.onText]}>{g.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel="Pattern">
                {shown.map(p => {
                  const on = p.id === tape.pattern;
                  const tile = tapeTile(p.id);
                  return (
                    <Pressable
                      key={p.id}
                      style={styles.patternBtn}
                      onPress={() => setTape({...tape, pattern: p.id})}
                      accessibilityRole="radio"
                      accessibilityState={{selected: on}}
                      accessibilityLabel={`${p.label} tape`}>
                      <View style={[styles.swatch, on && styles.swatchOn]}>
                        {tile ? <TileFill tile={tile} width={SWATCH.width} height={SWATCH.height} size={TILE_DP * 0.8} /> : null}
                      </View>
                      <Text style={[styles.patternLabel, on && styles.patternLabelOn]} numberOfLines={1}>
                        {p.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {pages > 1 ? (
                <View style={styles.pager}>
                  <Pressable
                    style={styles.pageBtn}
                    onPress={() => setPage(Math.max(0, page - 1))}
                    disabled={page === 0}
                    accessibilityRole="button"
                    accessibilityLabel="Previous patterns">
                    <Text style={[styles.pageArrow, page === 0 && styles.disabledLabel]}>‹</Text>
                  </Pressable>
                  <Text style={styles.pageText}>
                    {page + 1} / {pages}
                  </Text>
                  <Pressable
                    style={styles.pageBtn}
                    onPress={() => setPage(Math.min(pages - 1, page + 1))}
                    disabled={page === pages - 1}
                    accessibilityRole="button"
                    accessibilityLabel="More patterns">
                    <Text style={[styles.pageArrow, page === pages - 1 && styles.disabledLabel]}>›</Text>
                  </Pressable>
                </View>
              ) : null}
            </>
          ) : null}

          {section === 'tapeWidth'
            ? TAPE_WIDTHS.map(w => (
                <Option
                  key={w.id}
                  on={tape.width === w.id}
                  onPress={() => setTape({...tape, width: w.id})}
                  label={w.label}
                  visual={on => (
                    <View
                      style={[styles.tapeSample, {height: w.id === 'slim' ? 12 : 20}, on && styles.tapeSampleOn]}
                    />
                  )}
                />
              ))
            : null}

          {section === 'place' ? (
            <View style={styles.places} accessibilityRole="radiogroup" accessibilityLabel="Placement">
              {TAPE_PLACEMENTS.map(p => {
                const on = tape.placement === p.id;
                return (
                  <Pressable
                    key={p.id}
                    style={[styles.placeBtn, on && styles.placeBtnOn]}
                    onPress={() => setTape({...tape, placement: p.id})}
                    accessibilityRole="radio"
                    accessibilityState={{selected: on}}>
                    <PlaceIcon placement={p.id} on={on} />
                    <Text style={[styles.placeLabel, on && styles.onText]}>{p.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable
          style={[styles.primaryBtn, !changed && styles.primaryBtnDisabled]}
          onPress={() => onDone(border)}
          disabled={!changed}
          accessibilityRole="button"
          accessibilityState={{disabled: !changed}}>
          <Text style={[styles.primaryLabel, !changed && styles.primaryLabelDisabled]}>Apply</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** One full-width option row; inverted when selected. */
function Option({
  on,
  onPress,
  label: text,
  hint,
  visual,
}: {
  on: boolean;
  onPress: () => void;
  label: string;
  hint?: string;
  visual?: (on: boolean) => React.ReactNode;
}): React.JSX.Element {
  return (
    <Pressable
      style={[styles.option, on && styles.optionOn]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{selected: on}}>
      {visual ? <View style={styles.optionVisual}>{visual(on)}</View> : null}
      <View style={styles.optionText}>
        <Text style={[styles.optionLabel, on && styles.onText]}>{text}</Text>
        {hint ? <Text style={[styles.optionHint, on && styles.onText]}>{hint}</Text> : null}
      </View>
    </Pressable>
  );
}

/** A short horizontal sample of a line style. */
function LineSample({style, thickness, color}: {style: 'solid' | 'dash' | 'dot'; thickness: number; color: string}) {
  if (style === 'solid') {
    return <View style={{width: 56, height: thickness, borderRadius: thickness / 2, backgroundColor: color}} />;
  }
  const len = style === 'dash' ? 3 * thickness : thickness;
  const n = style === 'dash' ? 4 : 7;
  return (
    <View style={styles.sampleRow}>
      {Array.from({length: n}, (_, i) => (
        <View key={i} style={{width: len, height: thickness, borderRadius: thickness / 2, backgroundColor: color}} />
      ))}
    </View>
  );
}

/** A tiny photo with tape where this placement puts it. */
function PlaceIcon({placement, on}: {placement: TapePlacement; on: boolean}) {
  const tape = on ? '#fff' : '#000';
  const bar = (left: number, top: number, w: number, h: number, angle = 0, k = 0) => (
    <View
      key={k}
      style={{
        position: 'absolute',
        left,
        top,
        width: w,
        height: h,
        backgroundColor: tape,
        transform: [{rotate: `${angle}deg`}],
      }}
    />
  );
  const corners = {
    tl: bar(-6, 3, 20, 6, -45, 1),
    tr: bar(50, 3, 20, 6, 45, 2),
    bl: bar(-6, 35, 20, 6, 45, 3),
    br: bar(50, 35, 20, 6, -45, 4),
  };
  return (
    <View style={styles.placeIcon}>
      <View style={[styles.placePhoto, on && styles.placePhotoOn]} />
      {placement === 'topCorners' ? [corners.tl, corners.tr] : null}
      {placement === 'corners' ? [corners.tl, corners.tr, corners.bl, corners.br] : null}
      {placement === 'top' ? bar(20, 3, 24, 6) : null}
      {placement === 'frame'
        ? [bar(2, 3, 60, 5, 0, 1), bar(2, 40, 60, 5, 0, 2), bar(2, 3, 5, 42, 0, 3), bar(57, 3, 5, 42, 0, 4)]
        : null}
    </View>
  );
}

/**
 * The picture as it will look, fitted into `area` (dp): the same maths as the
 * render, at preview scale (`f` dp per page px).
 */
function previewLayout(src: Source, border: Border, area: Size) {
  const pr = PixelRatio.get();
  const photo = croppedPlacement(src.fullPlacement, src.size, src.edges);
  const ps = {width: photo.right - photo.left, height: photo.bottom - photo.top};
  const radiusPage = cornerRadius(src.corners, ps, pr);
  const page = frameLayout(ps, radiusPage, border, pr);
  const f = Math.min(area.width / page.canvas.width, area.height / page.canvas.height);
  const crop = {
    x: src.edges.left,
    y: src.edges.top,
    width: src.edges.right - src.edges.left,
    height: src.edges.bottom - src.edges.top,
  };
  const box = {width: ps.width * f, height: ps.height * f};
  // stageLayout maps source px → dp with `pixelRatio`; choose it so the photo box is `box`.
  const layout = stageLayout(src.size, 0, crop, Math.max(crop.width, crop.height), crop.width / box.width);
  return {layout, radius: radiusPage * f, frame: frameLayout(box, radiusPage * f, border, pr * f)};
}

const SWATCH = {width: 104, height: 36};

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#fff'},
  topBar: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderColor: '#000',
  },
  title: {flex: 1, textAlign: 'center', fontSize: 22, fontWeight: '600', color: '#000'},
  textBtn: {width: 112, height: 56, justifyContent: 'center', paddingHorizontal: 16},
  textBtnRight: {alignItems: 'flex-end'},
  textBtnLabel: {fontSize: 20, color: '#000'},
  disabledLabel: {color: '#8a8a8a'},
  onText: {color: '#fff'},

  preview: {flex: 1, minHeight: 200, alignItems: 'center', justifyContent: 'center', margin: 20},

  editor: {height: 456, flexDirection: 'row', borderTopWidth: 1, borderColor: '#000'},
  menu: {width: 168, paddingVertical: 12, paddingHorizontal: 10, gap: 8, borderRightWidth: 1, borderColor: '#000'},
  menuItem: {
    height: 64,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#000',
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  menuItemOn: {backgroundColor: '#000'},
  menuLabel: {fontSize: 18, fontWeight: '600', color: '#000'},
  menuValue: {fontSize: 14, color: '#555', marginTop: 2},
  panel: {flex: 1, padding: 12, gap: 8},

  option: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#000',
    paddingHorizontal: 16,
  },
  optionOn: {backgroundColor: '#000'},
  optionVisual: {width: 72, alignItems: 'flex-start', justifyContent: 'center'},
  optionText: {flex: 1},
  optionLabel: {fontSize: 19, color: '#000'},
  optionHint: {fontSize: 14, color: '#555', marginTop: 2},
  sampleRow: {flexDirection: 'row', alignItems: 'center', width: 56, justifyContent: 'space-between'},
  toneDot: {width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: '#000'},
  toneDotOn: {borderColor: '#fff'},
  tapeSample: {width: 56, backgroundColor: TAPE_BASE, borderWidth: 1.5, borderColor: '#000'},
  tapeSampleOn: {borderColor: '#fff'},

  groups: {flexDirection: 'row', gap: 8, marginBottom: 4},
  chip: {
    minWidth: 64,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: {backgroundColor: '#000'},
  chipLabel: {fontSize: 17, color: '#000'},
  grid: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  patternBtn: {width: SWATCH.width + 8, alignItems: 'center', paddingVertical: 4},
  swatch: {
    width: SWATCH.width,
    height: SWATCH.height,
    backgroundColor: TAPE_BASE,
    borderWidth: 1.5,
    borderColor: '#d6d6d6',
    overflow: 'hidden',
  },
  swatchOn: {borderWidth: 3, borderColor: '#000'},
  patternLabel: {fontSize: 14, color: '#000', marginTop: 4},
  patternLabelOn: {fontWeight: '700'},
  pager: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 'auto'},
  pageBtn: {width: 56, height: 48, alignItems: 'center', justifyContent: 'center'},
  pageArrow: {fontSize: 30, color: '#000'},
  pageText: {fontSize: 17, color: '#000'},

  places: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
  placeBtn: {
    width: 150,
    height: 104,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  placeBtnOn: {backgroundColor: '#000'},
  placeIcon: {width: 64, height: 48},
  placePhoto: {position: 'absolute', left: 4, top: 6, width: 56, height: 38, backgroundColor: '#9d9d9d', borderRadius: 4},
  placePhotoOn: {backgroundColor: '#5a5a5a'},
  placeLabel: {fontSize: 15, color: '#000'},

  footer: {paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24, borderTopWidth: 1, borderColor: '#000'},
  primaryBtn: {
    height: 60,
    borderRadius: 12,
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: {backgroundColor: '#fff', borderColor: '#8a8a8a'},
  primaryLabel: {fontSize: 21, fontWeight: '600', color: '#fff'},
  primaryLabelDisabled: {color: '#8a8a8a'},
});
