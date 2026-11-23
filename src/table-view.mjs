import {art, asset, card, esc, ico} from './ui.mjs';
import {gauges, phaseName, spaceText} from './board.mjs';

export function tableFrame() {
  return `<header id="session-bar" class="session-bar"></header>
    <nav class="table-switch" aria-label="Zobrazení herního stolu">
      <button data-do="panel" data-value="turn">${ico('bolt')} Tah</button>
      <button data-do="panel" data-value="map">${ico('map')} Mapa</button>
      <button data-do="panel" data-value="overview">${ico('grid')} Přehled</button>
    </nav>
    <div id="game-stage" data-panel="turn">
      <div class="table-layout" id="board-and-turn">
        <section id="map-pane" class="pane map-pane" aria-label="Mapa Tharsis"></section>
        <aside id="turn" class="pane turn" aria-label="Aktuální volba"></aside>
      </div>
      <section id="overview-panel" class="pane extra-panel" aria-label="Přehled partie" hidden></section>
      <section id="full-hand" class="pane extra-panel" aria-label="Rozložená ruka" hidden></section>
    </div>
    <section id="hand-dock" aria-labelledby="hand-heading">
      <div class="hand-bar">
        <div class="hand-label">${ico('cards')}<h2 id="hand-heading">Moje ruka</h2><span id="hand-count" class="hand-count"></span></div>
        <button class="hand-wallet" data-do="panel" data-value="overview" title="Zobrazit zásoby korporace"></button>
        <span id="playable-key" class="playable-key" hidden>${ico('check')} Lze zahrát</span>
        <div class="hand-tools">
          <button class="spread-hand" data-do="spread-hand" aria-controls="full-hand">${ico('grid')}<span>Rozložit</span></button>
          <div id="hand-paging" class="hand-paging">
            <button data-do="page-hand" data-value="-1" aria-label="Předchozí karty" title="Předchozí karty">${ico('chevron')}</button>
            <button data-do="page-hand" data-value="1" aria-label="Další karty" title="Další karty">${ico('chevron')}</button>
          </div>
        </div>
      </div>
      <div id="hand-rail" class="hand-rail" role="group" aria-labelledby="hand-heading"></div>
    </section>`;
}

export function sessionBar(game, table, view) {
  const solo = table.mode === 'solo';
  const limit = solo ? (view.options.prelude ? 12 : 14) : null;
  const mode = solo ? 'Sólová mise' : 'Stůl ' + esc(view.code);
  return `<div class="session-title">
      <p>${mode} <span>· ${esc(phaseName(game))}</span></p>
      <h1>Generace ${game.generation}${limit ? ` <small>/ ${limit}</small>` : ''}</h1>
    </div>
    ${gauges(game)}
    <button class="session-overview" data-do="panel" data-value="overview" aria-controls="overview-panel">${ico('grid')}<span>Přehled</span></button>`;
}

export function heldCard(item, playable, expanded = false) {
  const c = card(item.name);
  if (!c) return '';
  const cost = item.calculatedCost ?? c.cost;
  const ready = playable.has(item.name);
  const label = [c.name, cost + ' M€', ready ? 'lze zahrát' : '', 'Zobrazit kartu'].filter(Boolean).join(' · ');
  return `<button class="held-card kind-${esc(c.kind)}${ready ? ' playable' : ''}${expanded ? ' expanded' : ''}" data-do="detail" data-origin="hand" data-card="${esc(c.id)}" aria-label="${esc(label)}">
    <span class="held-art"><img src="${asset('art/' + art(c) + '.webp')}" alt="" loading="lazy">
      <span class="held-price">${esc(cost)} <small>M€</small></span>
      ${ready ? `<span class="ready-mark" aria-hidden="true">${ico('check')}</span>` : ''}
    </span>
    <span class="held-name">${esc(c.name)}</span>
    ${expanded ? `<span class="held-effect">${esc(c.text)}</span>` : ''}
  </button>`;
}

export function handContents(game, decision) {
  const selected = game.corporationCard ? null : decision?.initialProjects();
  const preview = selected != null && !game.cardsInHand.length;
  return {
    items: preview ? selected : game.cardsInHand,
    label: preview ? 'Karty k nákupu' : 'Moje ruka',
    empty: preview ? 'Projekty se tady objeví, jakmile je vybereš při přípravě korporace.' : 'V ruce teď nemáš žádné projekty.',
    playable: decision?.playableProjects() ?? new Map()
  };
}

export function placementBar(game, decision) {
  const placement = decision?.space();
  if (!placement) return '';
  const space = game.spaces.find(s => s.id === placement.selected);
  const next = decision.step + 1 < decision.steps.length;
  const enabled = space && !decision.pending && (next || decision.row());
  return `<div class="map-placement">
    <span aria-live="polite"><b>${space ? 'Pole ' + esc(space.id) : 'Vyber pole na mapě'}</b>
      <small>${space ? esc(spaceText(space, game).split(' · ').slice(1).join(' · ')) : 'Klepni na jedno ze zvýrazněných polí.'}</small></span>
    <button class="btn primary" data-do="${next ? 'next-step' : 'submit'}" ${enabled ? '' : 'disabled'}>${decision.pending ? 'Odesílám…' : next ? 'Další krok' : 'Potvrdit umístění'}</button>
  </div>`;
}
