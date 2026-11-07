import { patchPetName } from '../../lib/paintedName'
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLocale } from '../../i18n/LocaleContext'
import { Button } from '../../components/ui/Button'
import { ButtonLink } from '../../components/ui/ButtonLink'
import { ChoiceList } from '../../components/ui/ChoiceList'
import { Field } from '../../components/ui/Field'
import { HelpTip } from '../../components/ui/HelpTip'
import { ProgressSteps } from '../../components/ui/ProgressSteps'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { AnimatedPrice } from '../../components/public/AnimatedPrice'
import { OrnamentPreview } from '../../components/public/OrnamentPreview'
import { ItemTabs } from '../../components/public/ItemTabs'
import { ReviewCard } from '../../components/public/ReviewCard'
import { OrderReceipt } from '../../components/public/OrderReceipt'
import { OrnamentLoader } from '../../components/public/OrnamentLoader'
import { WaitlistSignup } from '../../components/public/WaitlistSignup'
import { SeasonClosed } from '../../components/public/SeasonClosed'
import { TrackDialog } from '../../components/public/TrackDialog'
import { IntroCurtain } from '../../components/public/IntroCurtain'
import { SleighWipe } from '../../components/public/SleighWipe'
import { CabinScene } from '../../components/public/CabinScene'
import { Countdown } from '../../components/public/Countdown'
import { GiftBoxReady } from '../../components/public/GiftBoxReady'
import { MarketStall } from '../../components/public/MarketStall'
import { PaintingOrnament } from '../../components/public/PaintingOrnament'
import { PetOrnamentMini } from '../../components/public/PetOrnamentMini'
import { CatFace, DogFace } from '../../components/public/PetFaces'
import { Snowfield } from '../../components/public/Snowfield'
import { VillageStreet } from '../../components/public/VillageStreet'
import { WinterBackdrop } from '../../components/public/WinterBackdrop'
import * as folk from '../../components/public/FlatFolk'
import * as town from '../../components/public/FlatTown'
import { BuyItemsStep } from '../public/buy/BuyItemsStep'
import { BuyDateStep } from '../public/buy/BuyDateStep'
import { BuyContactStep } from '../public/buy/BuyContactStep'
import { BuyPetStep } from '../public/buy/BuyPetStep'
import { BuyReviewStep } from '../public/buy/BuyReviewStep'
import { guideConfig, guideDates, guideDraft, guideItem } from '../../api/fixtures/designGuide'
import type { BuyItem } from '../../lib/buyDraft'
import type { BuyStepProps } from '../public/buy/shared'
import { contrastRatio } from '../../lib/contrast.mjs'
import referencePhoto from '../../../e2e/fixtures/pet.png'
import buy from '../public/BuyPage.module.css'
import styles from './DesignGuide.module.css'
import rulesUrl from '../../../../docs/design-system.md?url'

const stateKeys = ['default', 'hover', 'focus', 'pressed', 'selected', 'disabled', 'error', 'busy'] as const
const noJoin = async () => {}
const artComponents = { CabinScene: () => <CabinScene title="ArtWithGab" />, Countdown, GiftBoxReady: () => <GiftBoxReady label="ArtWithGab" tag="AWGDEMO" />, MarketStall, PaintingOrnament: () => <PaintingOrnament label="ArtWithGab" />, PetOrnamentMini, CatFace: () => <svg viewBox="0 0 100 100" aria-hidden="true"><CatFace /></svg>, DogFace: () => <svg viewBox="0 0 100 100" aria-hidden="true"><DogFace /></svg>, VillageStreet, WinterBackdrop, Snowfield, ...folk, ...town }
const css = (values: Record<string, string>) => values as CSSProperties

function Fixture({ title, source, children, states = false }: { title: string; source: string; children: ReactNode; states?: boolean }) {
  const { t } = useLocale()
  return <article className={styles.fixture}><h3>{title}</h3><a href={`/src/${source.split(' ·')[0]}`} target="_blank" rel="noreferrer"><code>{source}</code></a><a href={rulesUrl} target="_blank" rel="noreferrer">docs/design-system.md</a><p>{t(states ? 'guideInteractive' : 'guideStatic')}</p>{children}</article>
}

function Tokens() {
  const { t } = useLocale()
  const [tokens, setTokens] = useState<Record<string, string>>({})
  useEffect(() => {
    const computed = getComputedStyle(document.documentElement)
    const names = ['surface', 'surface-raised', 'text', 'text-muted', 'border', 'control-border', 'primary', 'primary-hover', 'primary-pressed', 'on-primary', 'selected', 'selected-surface', 'selection-hover', 'focus', 'focus-gap', 'success', 'success-surface', 'warning', 'warning-surface', 'error', 'error-surface', 'info', 'info-surface', 'cart-surface', 'cart-ink', 'disabled-surface', 'disabled-text', 'overlay'].map(role => `--color-${role}`)
    for (const color of ['red', 'green', 'beige']) names.push(`--ornament-${color}`, `--portrait-${color}`)
    const frame = requestAnimationFrame(() => setTokens(Object.fromEntries(names.map(name => [name, computed.getPropertyValue(name).trim()]))))
    return () => cancelAnimationFrame(frame)
  }, [])
  return <>
    <section><h2>{t('guideColours')}</h2><p>{t('guideContrast')}</p><div className={styles.grid}>{Object.entries(tokens).map(([name, value]) => {
      const boundary = ['--color-selected', '--color-focus', '--color-control-border', '--color-border'].includes(name)
      const primary = ['--color-primary', '--color-primary-hover', '--color-primary-pressed'].includes(name)
      const ink = name.includes('text') || name.endsWith('-ink') || ['--color-error', '--color-warning', '--color-success', '--color-info'].includes(name)
      const foreground = primary || name === '--color-on-primary' ? tokens['--color-on-primary'] : boundary || ink ? value : tokens['--color-text']
      const background = name === '--color-on-primary' ? tokens['--color-primary'] : boundary || ink ? tokens['--color-surface'] : value
      const ratio = contrastRatio(foreground, background)
      return <article className={styles.fixture} key={name}><code>{name}</code><div className={styles.swatch} style={{ background: `var(${name})` }} /><code>{value}</code><span>{ratio === null ? t('guideContrastNA') : `${ratio.toFixed(2)}:1 · ${foreground} / ${background}`}</span></article>
    })}</div></section>
    <section><h2>{t('guideType')}</h2>{['display', 'h1', 'h2', 'h3', 'label', 'body', 'hint', 'caption', 'price', 'button'].map(role => <div key={role}><code>--type-{role}-*</code><p className={styles.type} style={{ ...css(Object.fromEntries(['size', 'line', 'weight', 'tracking'].map(property => [`--guide-type-${property}`, `var(--type-${role}-${property})`]))), fontFamily: `var(--font-${['display', 'h1', 'h2', 'h3'].includes(role) ? 'display' : 'sans'})` }}>{t('guideTypeSample')}</p></div>)}</section>
    <section><h2>{t('guideSpacing')}</h2>{Array.from({ length: 10 }, (_, i) => <div key={i}><code>--space-{i + 1}</code><div className={styles.ruler} style={css({ '--guide-length': `var(--space-${i + 1})` })} /></div>)}</section>
    <section><h2>{t('guideShape')}</h2><div className={styles.grid}>{['small', 'control', 'panel', 'pill', 'circle'].map(role => <div key={role}><code>--radius-{role}</code><div className={styles.radius} style={css({ '--guide-radius': `var(--radius-${role})` })} /></div>)}{['none', '1', '2'].map(role => <div key={role}><code>--shadow-{role}</code><div className={styles.elevation} style={css({ '--guide-shadow': `var(--shadow-${role})` })} /></div>)}{['thin', 'control', 'inset'].map(role => <p key={role} style={{ borderBottom: `var(--border-${role}) solid var(--color-control-border)` }}><code>--border-{role}</code></p>)}</div></section>
  </>
}

function Primitives() {
  const { t } = useLocale()
  const [segment, setSegment] = useState('front')
  const [choice, setChoice] = useState<string | null>(null)
  return <section id="components"><h2>{t('guideComponents')}</h2><div className={styles.grid}>
    {(['primary', 'secondary', 'ghost', 'danger', 'choice'] as const).map(variant => <Fixture title={`Button · ${variant}`} source="components/ui/Button.tsx · §7.2" key={variant} states>{stateKeys.map(state => <div key={state}><p>{t(`guideState_${state}`)}</p>{(state === 'selected' && variant !== 'choice') || state === 'error' ? <p>{t('guideNA')}</p> : <Button variant={variant} selected={variant === 'choice' ? state === 'selected' : undefined} disabled={state === 'disabled' || state === 'busy'} aria-busy={state === 'busy'}>{t(state === 'busy' ? 'saving' : 'continue')}</Button>}</div>)}</Fixture>)}
    <Fixture title="ButtonLink" source="components/ui/ButtonLink.tsx · §7.2" states><ButtonLink to="/dev/design#components">{t('continue')}</ButtonLink><ButtonLink variant="secondary" to="/dev/design#components">{t('back')}</ButtonLink><ButtonLink variant="ghost" to="/dev/design#components">{t('change')}</ButtonLink></Fixture>
    <Fixture title="ChoiceList" source="components/ui/ChoiceList.tsx · §7.3" states><ChoiceList legend={t('shopColour')} value={choice} onChange={setChoice} name="guide-choice" choices={[{ value: 'red', title: t('colorRed'), body: t('previewDisclaimer') }, { value: 'green', title: t('colorGreen') }]} /><p>{t('guideUnsupportedStates')}</p></Fixture>
    <Fixture title="SegmentedControl" source="components/ui/SegmentedControl.tsx · §7.4" states><SegmentedControl tone="public" legend={t('previewSide')} value={segment} onChange={setSegment} options={[{ value: 'front', label: t('previewFront') }, { value: 'back', label: t('previewBack') }]} name="guide-side" /></Fixture>
    <Fixture title="Field" source="components/ui/Field.tsx · §7.5" states>{(['default', 'disabled', 'error', 'busy'] as const).map(state => <Field key={state} label={t('yourName')} htmlFor={`guide-field-${state}`} hint={t('phoneHint')} error={state === 'error' ? t('required') : undefined}><input id={`guide-field-${state}`} disabled={state === 'disabled' || state === 'busy'} aria-busy={state === 'busy'} /></Field>)}<Field label={t('noteLabel')} htmlFor="guide-textarea"><textarea id="guide-textarea" /></Field><Field label={t('shopColour')} htmlFor="guide-select"><select id="guide-select"><option>{t('colorRed')}</option><option>{t('colorGreen')}</option></select></Field></Fixture>
    <Fixture title="HelpTip" source="components/ui/HelpTip.tsx · §7.6" states><div className={styles.row}>{t('shopCity')}<HelpTip label={t('explainVienna')}>{t('viennaHelp')}</HelpTip></div><div className={styles.row}>{t('shopFinish')}<HelpTip label={t('explainFinishes')}>{t('finishExplanation')}</HelpTip></div></Fixture>
    <Fixture title="ProgressSteps" source="components/ui/ProgressSteps.tsx · §7.13">{[0, 1, 2, 3].map(current => <ProgressSteps key={current} labels={[t('paidTimeline'), t('paintingTimeline'), t('deliveryTimeline')]} current={current} label={t('shopProgress')} />)}</Fixture>
  </div></section>
}

function ShopFixture() {
  const { t, locale } = useLocale()
  const [draft, setDraft] = useState(guideDraft)
  const [activeUid, setActiveUid] = useState(draft.items[0].uid)
  const [screen, setScreen] = useState('design')
  const [state, setState] = useState('ready')
  const [datesRetry, setDatesRetry] = useState(0)
  const [preview, setPreview] = useState<Partial<BuyItem> | null>(null)
  const [photos, setPhotos] = useState(0)
  const [long, setLong] = useState(false)
  const active = draft.items.find(item => item.uid === activeUid) ?? draft.items[0]
  const patch: BuyStepProps['patch'] = partial => setDraft(current => ({ ...current, ...partial }))
  const patchItem: BuyStepProps['patchItem'] = (uid, partial) => setDraft(current => ({ ...current, items: current.items.map(item => item.uid === uid ? patchPetName(item, partial) : item) }))
  const shared: BuyStepProps = {
    t, draft, config: state === 'sold-out' ? { ...guideConfig, colors: guideConfig.colors.map(option => ({ ...option, inStock: false })) } : guideConfig, itemPrice: item => guideConfig.customPrice + (item.withName ? guideConfig.nameExtra : 0), patch, patchItem,
    err: key => state === 'error' ? t(key.startsWith('photos') ? 'photoInvalid' : 'required') : undefined,
    described: key => state === 'error' ? `${key}-error` : undefined,
    photoErrors: state === 'upload-error' ? { [active.uid]: t('photoInvalid') } : {},
    addFiles: async uid => patchItem(uid, { photos: Array.from({ length: Math.min(6, photos + 1) }, (_, i) => ({ id: `guide-photo-${i}`, name: 'reference.png', dataUrl: referencePhoto })) }),
    dates: state === 'empty' ? [] : guideDates, datesState: state === 'loading' ? 'loading' : state === 'network-error' ? 'error' : 'ready', setDatesRetry, pickupDays: [], pickupState: 'idle',
    formatDate: date => new Intl.DateTimeFormat(locale === 'de' ? 'de-AT' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${date}T12:00:00`)),
    serverError: state === 'error' ? t('shopCheckoutError') : '',
  }
  const itemsTotal = draft.items.reduce((sum, item) => sum + shared.itemPrice(item), 0)
  return <section className={styles.composition}><h2>{t('guideCompositions')}</h2><code>pages/public/buy/* · §§7.9–7.16</code>
    <div className={styles.toolbar}>{['design', 'pet', 'delivery', 'review'].map(value => <Button key={value} variant="secondary" onClick={() => setScreen(value)}>{t(`guideScreen_${value}`)}</Button>)}</div>
    <div className={styles.toolbar}><label>{t('guideState')} <select value={state} onChange={event => setState(event.target.value)}>{['ready', 'loading', 'empty', 'network-error', 'error', 'upload-error', 'sold-out'].map(value => <option key={value} value={value}>{t(`guideState_${value}`)}</option>)}</select></label><label>{t('guidePhotos')} <select value={photos} onChange={event => { const count = Number(event.target.value); setPhotos(count); patchItem(active.uid, { photos: Array.from({ length: count }, (_, i) => ({ id: `guide-photo-${i}`, name: 'reference.png', dataUrl: referencePhoto })) }) }}>{[0, 1, 6].map(value => <option key={value}>{value}</option>)}</select></label><label><input type="checkbox" checked={long} onChange={event => { setLong(event.target.checked); patchItem(active.uid, { petName: event.target.checked ? t('guideLongName') : 'Luna' }) }} />{t('guideLongLabel')}</label></div>
    <p>{t('guideRetryCount', { n: datesRetry })}</p>
    <ItemTabs items={draft.items} activeUid={activeUid} maxItems={guideConfig.maxItems} onSelect={setActiveUid} onAdd={() => { const item = guideItem(`guide-${draft.items.length + 1}`); patch({ items: [...draft.items, item] }); setActiveUid(item.uid) }} />
    {draft.items.map(item => <div key={item.uid} role="tabpanel" id={`panel-${item.uid}`} aria-labelledby={`tab-${item.uid}`} hidden={active.uid !== item.uid}>{active.uid === item.uid && <>
      {screen === 'design' && <><OrnamentPreview key={item.uid} item={{ ...item, ...preview }} /><BuyItemsStep {...shared} activeUid={active.uid} preview={setPreview} onJoinWaitlist={noJoin} /></>}
      {screen === 'pet' && <BuyPetStep {...shared} activeUid={active.uid} changeName={() => setScreen('design')} />}
      {screen === 'delivery' && <><BuyDateStep {...shared} /><BuyContactStep {...shared} validFields={[]} validateField={() => {}} /></>}
      {screen === 'review' && <BuyReviewStep {...shared} total={itemsTotal} deliveryFee={0} itemsTotal={itemsTotal} changed="" go={index => setScreen(index < 2 ? 'design' : 'delivery')} />}
    </>}</div>)}
    <div className={buy.actions}><Button variant="secondary">{t('back')}</Button><Button size="lg">{t('shopPayStripe')} · <AnimatedPrice value={itemsTotal} locale={locale} /></Button></div>
  </section>
}

function PublicComponents() {
  const { t, locale } = useLocale()
  const [price, setPrice] = useState(49.99)
  return <section><h2>{t('guidePublic')}</h2><div className={styles.grid}>
    <Fixture title="OrnamentPreview" source="components/public/OrnamentPreview.tsx · §7.16" states><OrnamentPreview item={{ ...guideItem('guide-placeholder'), color: '', finish: '', withName: false }} />{(['red', 'green', 'beige'] as const).map(color => <OrnamentPreview key={color} item={{ ...guideItem(`guide-${color}`), color, finish: color === 'green' ? 'matte' : 'shiny' }} />)}<OrnamentPreview item={guideItem('guide-static')} static /></Fixture>
    <Fixture title="ReviewCard" source="components/public/ReviewCard.tsx · §7.9"><ReviewCard title={t('reviewFromStall')} rows={[{ label: t('shopColour'), value: t('colorRed') }, { label: t('backName'), value: 'LUNA' }]} /></Fixture>
    <Fixture title="AnimatedPrice" source="components/public/AnimatedPrice.tsx · §7.15"><AnimatedPrice value={price} locale={locale} /><Button variant="secondary" onClick={() => setPrice(value => value === 49.99 ? 62.98 : 49.99)}>{t('shopNameOnBack')}</Button></Fixture>
    <Fixture title="OrderReceipt" source="components/public/OrderReceipt.tsx · §§7.9,7.15">{(['unpaid', 'deposit', 'paid'] as const).map(paymentState => <OrderReceipt key={paymentState} items={[{ petName: 'Luna', kind: 'custom', color: 'red', cost: 49.99, backName: 'LUNA' }, { petName: '', kind: 'finished', backName: '', cost: 20 }]} total={69.99} paymentState={paymentState} />)}</Fixture>
    <Fixture title="OrnamentLoader" source="components/public/OrnamentLoader.tsx · §7.18"><OrnamentLoader /><p>{t('shopDatesLoading')}</p></Fixture>
    <Fixture title="WaitlistSignup" source="components/public/WaitlistSignup.tsx · §7.19" states>{(['idle', 'busy', 'error', 'success'] as const).map(state => <WaitlistSignup key={state} initialState={state} onJoin={noJoin} />)}</Fixture>
    <Fixture title="SeasonClosed" source="components/public/SeasonClosed.tsx · §7.19" states><SeasonClosed onJoin={noJoin} /></Fixture>
    {['TrackDialog', 'IntroCurtain', 'SleighWipe'].map(name => <Fixture title={name} source={`components/public/${name}.tsx`} key={name} states><iframe className={styles.frame} title={name} src={`/dev/design?isolated=${name}`} loading="lazy" /></Fixture>)}
    {Object.entries(artComponents).map(([name]) => <Fixture title={name} source={`components/public/${name in folk ? 'FlatFolk' : name in town ? 'FlatTown' : name === 'CatFace' || name === 'DogFace' ? 'PetFaces' : name}.tsx`} key={name}><iframe className={styles.frame} title={name} src={`/dev/design?isolated=${name}`} loading="lazy" key={locale} /></Fixture>)}
  </div></section>
}

function Isolated({ name }: { name: string }) {
  const { t } = useLocale()
  const [state, setState] = useState('default')
  const [show, setShow] = useState(false)
  const [motion, setMotion] = useState(false)
  useEffect(() => { document.documentElement.dataset.guideMotion = motion ? 'paused' : 'running'; return () => { delete document.documentElement.dataset.guideMotion } }, [motion])
  const Art = artComponents[name as keyof typeof artComponents]
  if (Art) return <main className={`${styles.isolated} ${styles.art}`}><Art /></main>
  return <main className={styles.isolated}><div className={styles.toolbar}><Button variant="secondary" onClick={() => setShow(true)}>{t('guideOpen')}</Button><Button variant="secondary" onClick={() => { setMotion(value => !value); if (name === 'SleighWipe') setShow(false) }}>{t('pausePreview')}</Button><select aria-label={t('guideState')} value={state} onChange={event => setState(event.target.value)}>{['default', 'error', 'busy', 'leaving'].map(value => <option key={value}>{value}</option>)}</select></div>
    {show && name === 'TrackDialog' && <TrackDialog onClose={() => setShow(false)} onSubmit={() => setShow(false)} error={state === 'error' ? t('trackNotFound') : undefined} lookup={state === 'busy' ? () => new Promise(() => {}) : async () => { throw new Error('Synthetic lookup failure') }} />}
    {show && name === 'IntroCurtain' && <IntroCurtain label={t('introLoading')} onReveal={() => {}} onDone={() => setShow(false)} />}
    {show && name === 'SleighWipe' && <SleighWipe label={t('shopDatesLoading')} leaving={state === 'leaving'} />}
  </main>
}

export function DesignGuide() {
  const { t, locale, setLocale } = useLocale()
  const [params] = useSearchParams()
  const [motion, setMotion] = useState('paused')
  const [zoom, setZoom] = useState(false)
  useEffect(() => {
    document.documentElement.dataset.guideMotion = motion
    return () => { delete document.documentElement.dataset.guideMotion }
  }, [motion])
  const isolated = params.get('isolated')
  if (isolated) return <Isolated name={isolated} />
  return <main className={styles.guide} data-zoom={zoom}><header><h1>{t('guideTitle')}</h1><p>{t('guideLead')}</p><code>docs/design-system.md · §12.3</code><div className={styles.toolbar}><SegmentedControl tone="public" legend={t('lang')} name="guide-language" value={locale} onChange={setLocale} options={[{ value: 'de', label: 'DE' }, { value: 'en', label: 'EN' }]} /><label>{t('guideMotion')} <select value={motion} onChange={event => setMotion(event.target.value)}>{['paused', 'running', 'reduced'].map(value => <option key={value} value={value}>{t(`guideMotion_${value}`)}</option>)}</select></label><label><input type="checkbox" checked={zoom} onChange={event => setZoom(event.target.checked)} />{t('guideZoom')}</label></div></header><Tokens /><Primitives /><ShopFixture /><PublicComponents /></main>
}
