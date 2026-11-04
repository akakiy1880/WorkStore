// Офис Маркет: логика витрины. Товары и категории лежат в products.js

const CARD_NUMBER = '9860246602806837';
const ROTATE_MS = 5000;
const SEARCH_DELAY_MS = 150;
const COPY_FLASH_MS = 1600;
const TOTAL_ANIMATION_MS = 360;
const THEME_COLORS = { light: '#EEF1F5', dark: '#0C0F14' };
const EASE = 'cubic-bezier(.2,.7,.2,1)';

const ICONS = {
    plus: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    minus: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>'
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const isPhone = () => matchMedia('(max-width: 999px)').matches;
const formatPrice = (n) => n.toLocaleString('ru-RU');
const esc = (text) => String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const plural = (n) => {
    const tens = n % 100, ones = n % 10;
    if (tens > 10 && tens < 20) return 'товаров';
    if (ones === 1) return 'товар';
    return ones > 1 && ones < 5 ? 'товара' : 'товаров';
};

// --- данные ---

const hasDiscount = (p) => !!p.oldprice && !p.outOfStock;

// Порядок витрины: скидки, новинки, остальное, в конце то, чего нет в наличии
const rank = (p) => {
    if (p.outOfStock) return 3;
    if (hasDiscount(p)) return 0;
    return p.isNew ? 1 : 2;
};

const products = productsRaw
    .map((raw, index) => {
        const images = [].concat(raw.images ?? raw.img ?? []).filter(Boolean);
        return { ...raw, id: index + 1, originalIndex: index, images, img: images[0] || '' };
    })
    .sort((a, b) => rank(a) - rank(b) || a.originalIndex - b.originalIndex);

const productById = new Map(products.map((p) => [p.id, p]));
const brokenImages = new Map();

const state = {
    cart: {},
    category: 'all',
    query: '',
    sort: 'default',
    copied: { sum: false, card: false },
    flashing: null,
    zeroHint: false,
    shownTotal: 0,
    productId: null,
    gallery: [],
    galleryIndex: 0,
    overlays: { cart: false, product: false, confirm: false }
};

const cartTotal = () => Object.entries(state.cart).reduce((sum, [id, qty]) => sum + productById.get(+id).price * qty, 0);
const cartCount = () => Object.values(state.cart).reduce((sum, qty) => sum + qty, 0);

// --- каталог ---

const stepperHtml = (p, className, middle) => `
    <div class="step ${className}">
        <button type="button" data-action="dec" aria-label="Убрать одну штуку: ${esc(p.name)}">${ICONS.minus}</button>
        ${middle}
        <button type="button" data-action="inc" aria-label="Добавить ещё одну: ${esc(p.name)}">${ICONS.plus}</button>
    </div>`;

const cardControlHtml = (p) => {
    if (p.outOfStock) return '<span class="out-tag">Нет в наличии</span>';
    const qty = state.cart[p.id];
    if (!qty) return `<button type="button" class="add" data-action="inc" aria-label="Добавить: ${esc(p.name)}">${ICONS.plus}</button>`;
    return stepperHtml(p, 'on-card', `<span class="step-mid mono"><span class="qty">${qty}</span><small>${formatPrice(p.price)}</small></span>`);
};

const cardHtml = (p, index) => {
    const discount = hasDiscount(p);
    const percent = discount ? Math.round((1 - p.price / p.oldprice) * 100) : 0;
    const badges = [
        discount ? `<span class="badge badge-sale">${percent > 0 ? `−${percent}%` : 'Скидка'}</span>` : '',
        p.isNew && !p.outOfStock ? '<span class="badge badge-new">Новинка</span>' : ''
    ].join('');
    const classes = ['card', discount && 'is-sale', p.outOfStock && 'is-out'].filter(Boolean).join(' ');
    const loading = index < 6 ? 'fetchpriority="high"' : 'loading="lazy"';

    return `
    <article class="${classes}" data-id="${p.id}" style="--i:${Math.min(index, 8)}">
        <button type="button" class="card-open" data-action="open-product">
            <span class="photo"><img src="${esc(p.img)}" alt="${esc(p.name)}" width="150" height="150" decoding="async" ${loading}></span>
            <span class="card-name">${esc(p.name)}</span>
            <span class="card-desc">${esc(p.desc)}</span>
            <span class="card-price">
                ${discount ? `<s class="old mono">${formatPrice(p.oldprice)}</s>` : ''}
                <span class="card-price-now"><span class="price mono">${formatPrice(p.price)}</span> <span class="unit">сум</span></span>
            </span>
        </button>
        ${badges ? `<div class="badges">${badges}</div>` : ''}
        <div class="card-control">${cardControlHtml(p)}</div>
    </article>`;
};

const matchesSearch = (p) => {
    const q = state.query.trim().toLowerCase();
    if (!q) return true;
    const digits = q.replace(/\s/g, '');
    return p.name.toLowerCase().includes(q)
        || p.desc.toLowerCase().includes(q)
        || String(p.price).includes(digits)
        || (!!p.oldprice && String(p.oldprice).includes(digits));
};

const sorters = {
    new: (a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0) || a.originalIndex - b.originalIndex,
    cheaper: (a, b) => a.price - b.price || a.originalIndex - b.originalIndex,
    expensive: (a, b) => b.price - a.price || a.originalIndex - b.originalIndex
};

const visibleProducts = () => {
    const list = products.filter((p) => (state.category === 'all' || p.category === state.category) && matchesSearch(p));
    if (sorters[state.sort]) list.sort(sorters[state.sort]);
    return [...list.filter((p) => !p.outOfStock), ...list.filter((p) => p.outOfStock)];
};

const renderProducts = () => {
    const list = visibleProducts();
    $('#products').innerHTML = list.length
        ? list.map(cardHtml).join('')
        : '<div class="nothing"><div>Ничего не нашлось</div><button type="button" class="link-btn" data-action="reset-filters">Сбросить поиск</button></div>';
};

const renderCategories = () => {
    const box = $('#categories');
    box.innerHTML = categories.map((c) => {
        const on = c.id === state.category;
        return `<button type="button" class="chip${on ? ' is-on' : ''}" data-action="category" data-category="${c.id}" aria-pressed="${on}">${esc(c.name)}</button>`;
    }).join('');
    if (box.scrollWidth > box.clientWidth) {
        $('.chip.is-on', box)?.scrollIntoView({ behavior: calm() ? 'auto' : 'smooth', inline: 'center', block: 'nearest' });
    }
};

// Перерисовка внутри элемента не должна терять фокус клавиатуры
const replaceKeepingFocus = (box, html) => {
    const hadFocus = box.contains(document.activeElement);
    box.innerHTML = html;
    if (hadFocus) $('[data-action="inc"], [data-action="dec"]', box)?.focus();
};

const popQty = (box) => {
    if (calm()) return;
    $('.qty', box)?.animate([{ transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 220, easing: EASE });
};

const updateCard = (id) => {
    const box = $(`.card[data-id="${id}"] .card-control`);
    if (!box) return;
    const qty = state.cart[id];
    const qtyEl = $('.qty', box);
    if (qty && qtyEl) {
        qtyEl.textContent = qty;
        popQty(box);
    } else {
        replaceKeepingFocus(box, cardControlHtml(productById.get(id)));
    }
};

// --- корзина и оплата ---

const lineHtml = (p) => {
    const qty = state.cart[p.id];
    return `
    <div class="line" data-id="${p.id}">
        <div class="line-main">
            <div class="line-name">${esc(p.name)}</div>
            <div class="line-calc mono">${qty} × ${formatPrice(p.price)}</div>
        </div>
        ${stepperHtml(p, 'soft', `<span class="qty mono">${qty}</span>`)}
        <div class="line-sum mono">${formatPrice(p.price * qty)}</div>
    </div>`;
};

const renderCart = () => {
    const box = $('#cart-lines');
    const items = products.filter((p) => state.cart[p.id]).sort((a, b) => a.originalIndex - b.originalIndex);
    const sameLines = items.length > 0 && items.map((p) => p.id).join() === $$('.line', box).map((el) => el.dataset.id).join();

    $('#clear-cart').hidden = items.length === 0;
    if (sameLines) {
        items.forEach((p) => {
            const line = $(`.line[data-id="${p.id}"]`, box);
            const qty = state.cart[p.id];
            if ($('.qty', line).textContent === String(qty)) return;
            $('.qty', line).textContent = qty;
            $('.line-calc', line).textContent = `${qty} × ${formatPrice(p.price)}`;
            $('.line-sum', line).textContent = formatPrice(p.price * qty);
            popQty(line);
        });
        return;
    }
    replaceKeepingFocus(box, items.length
        ? items.map(lineHtml).join('')
        : '<div class="empty-note">Пока пусто. Нажмите плюс на товаре, и он появится в корзине.</div>');
};

const renderPay = () => {
    const total = cartTotal();
    const count = cartCount();
    const { copied, flashing, zeroHint } = state;

    $('#pay-caption').textContent = count ? `Итого · ${count} ${plural(count)}` : 'Корзина пуста';

    const sum = $('#copy-sum');
    sum.classList.toggle('is-kept', copied.sum);
    sum.classList.toggle('is-done', flashing === 'sum');
    sum.classList.toggle('is-zero', total === 0);
    sum.classList.toggle('is-empty', zeroHint);
    $('#copy-sum-label').textContent = copied.sum ? 'Скопировано' : zeroHint ? 'Выберите товар' : 'Копировать сумму';

    const card = $('#copy-card');
    card.classList.toggle('is-kept', copied.card);
    card.classList.toggle('is-done', flashing === 'card');
    $('#copy-card-cap').textContent = copied.card ? 'Карта скопирована' : 'Карта';

    $('#pay-click').classList.toggle('is-zero', total === 0);
};

let totalFrame;
let totalTimer;

// Сумма бежит к новому значению. Кадры браузер может придержать,
// поэтому точное значение всегда ставит таймер
const animateTotal = () => {
    const el = $('#pay-sum');
    const from = state.shownTotal;
    const to = cartTotal();
    const paint = (value) => {
        state.shownTotal = value;
        el.textContent = formatPrice(value);
    };
    cancelAnimationFrame(totalFrame);
    clearTimeout(totalTimer);
    if (calm()) return paint(to);
    const start = performance.now();
    const tick = (now) => {
        const t = Math.min((now - start) / TOTAL_ANIMATION_MS, 1);
        paint(Math.round(from + (to - from) * (1 - (1 - t) ** 3)));
        if (t < 1) totalFrame = requestAnimationFrame(tick);
    };
    totalFrame = requestAnimationFrame(tick);
    totalTimer = setTimeout(() => {
        cancelAnimationFrame(totalFrame);
        paint(to);
    }, TOTAL_ANIMATION_MS + 60);
};

// Точка летит от кнопки к сумме
const flyToTotal = (from) => {
    if (calm() || !from?.isConnected) return;
    const a = from.getBoundingClientRect();
    const b = $('#pay-sum').getBoundingClientRect();
    const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2;
    const x1 = b.left + 40, y1 = b.top + b.height / 2;
    $('#fly').animate([
        { transform: `translate(${x0}px, ${y0}px) scale(1)`, opacity: 1 },
        { transform: `translate(${(x0 + x1) / 2}px, ${Math.min(y0, y1) - 36}px) scale(1.1)`, opacity: 1, offset: .45 },
        { transform: `translate(${x1}px, ${y1}px) scale(.35)`, opacity: .3 }
    ], { duration: 520, easing: 'cubic-bezier(.3,.6,.3,1)' });
};

// Новый состав корзины делает прошлое копирование неактуальным
const afterCartChange = () => {
    clearTimeout(copyTimer);
    state.copied = { sum: false, card: false };
    state.flashing = null;
    state.zeroHint = false;
    renderCart();
    renderPay();
    animateTotal();
};

const changeQty = (id, delta, source) => {
    const product = productById.get(id);
    if (!product || (delta > 0 && product.outOfStock)) return;
    if (delta > 0) flyToTotal(source);
    const qty = (state.cart[id] || 0) + delta;
    if (qty > 0) state.cart[id] = qty;
    else delete state.cart[id];
    updateCard(id);
    if (state.productId === id) renderProductControl();
    afterCartChange();
};

const clearCart = () => {
    const ids = Object.keys(state.cart).map(Number);
    state.cart = {};
    ids.forEach(updateCard);
    if (state.productId !== null) renderProductControl();
    afterCartChange();
    announce('Корзина очищена');
};

// --- копирование ---

let copyTimer;

const announce = (message) => { $('#status').textContent = message; };

// На http и в старых браузерах navigator.clipboard нет
const legacyCopy = (text) => {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;opacity:0';
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
};

const writeClipboard = async (text) => {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return legacyCopy(text);
    }
};

const copyValue = async (which, text, message) => {
    const ok = await writeClipboard(text);
    announce(ok ? message : 'Не удалось скопировать');
    if (!ok) return false;
    clearTimeout(copyTimer);
    state.copied[which] = true;
    state.flashing = which;
    state.zeroHint = false;
    renderPay();
    copyTimer = setTimeout(() => {
        state.flashing = null;
        renderPay();
    }, COPY_FLASH_MS);
    return true;
};

const copySum = () => {
    const total = cartTotal();
    if (total > 0) return copyValue('sum', String(total), `Сумма ${formatPrice(total)} скопирована`);
    clearTimeout(copyTimer);
    state.zeroHint = true;
    renderPay();
    copyTimer = setTimeout(() => {
        state.zeroHint = false;
        renderPay();
    }, COPY_FLASH_MS);
};

// --- окна: корзина-шторка, товар, подтверждение ---

const returnFocus = {};

const syncOverlays = () => {
    const { cart, product, confirm } = state.overlays;
    const phoneCart = cart && isPhone();
    const items = $('#cart-items');

    document.body.classList.toggle('is-cart', phoneCart);
    document.body.classList.toggle('is-locked', phoneCart || product || confirm);
    items.classList.toggle('is-open', phoneCart);
    $('#cart-scrim').classList.toggle('is-open', phoneCart);
    $('#pay-cart').setAttribute('aria-expanded', phoneCart);
    $('#product').classList.toggle('is-open', product);
    $('#product-scrim').classList.toggle('is-open', product);
    $('#confirm').classList.toggle('is-open', confirm);
    $('#confirm-scrim').classList.toggle('is-open', confirm);

    $('#page').inert = phoneCart || product || confirm;
    $('#receipt').inert = product || confirm;
    $('#product').inert = confirm;
};

const openOverlay = (name, target) => {
    returnFocus[name] = document.activeElement;
    state.overlays[name] = true;
    syncOverlays();
    target?.focus({ preventScroll: true });
};

const closeOverlay = (name) => {
    if (!state.overlays[name]) return;
    state.overlays[name] = false;
    syncOverlays();
    if (returnFocus[name]?.isConnected) returnFocus[name].focus({ preventScroll: true });
};

const openCart = () => {
    $('#cart-items').classList.add('is-printing');
    setTimeout(() => $('#cart-items').classList.remove('is-printing'), 700);
    openOverlay('cart', $('#cart-close'));
};

// --- карточка товара ---

const renderGallery = () => {
    const { gallery, galleryIndex } = state;
    const img = $('#product-img');
    const src = gallery[galleryIndex] || '';
    if (img.getAttribute('src') !== src) img.src = src;
    $('#product-gallery').classList.toggle('multi', gallery.length > 1);
    $('#gallery-dots').innerHTML = gallery.length > 1
        ? gallery.map((_, i) => `<button type="button" class="gal-dot${i === galleryIndex ? ' is-on' : ''}" data-action="gallery-go" data-index="${i}" aria-label="Фото ${i + 1}"></button>`).join('')
        : '';
};

const stepGallery = (delta) => {
    const count = state.gallery.length;
    if (count < 2) return;
    state.galleryIndex = (state.galleryIndex + delta + count) % count;
    renderGallery();
};

// Размер упаковки из описания: «0.5л», «40г», «250мл»
const packSize = (desc) => {
    const match = (desc || '').match(/([0-9.]+)\s*(л|г|мл)/i);
    if (!match) return null;
    const value = parseFloat(match[1]);
    const unit = match[2].toLowerCase();
    return { grams: unit === 'л' ? value * 1000 : value, label: `${match[1]} ${unit}` };
};

const factsHtml = (p) => {
    const k = p.kbju;
    // нули и пустой объект означают, что данных нет
    if (!k || !(k.kcal || k.protein || k.fat || k.carbs)) return '';
    const pack = packSize(p.desc);
    const perPack = (value, digits) => (pack ? +(value * pack.grams / 100).toFixed(digits) : '');
    const rows = [['Ккал', k.kcal, 0], ['Белки, г', k.protein, 1], ['Жиры, г', k.fat, 1], ['Углеводы, г', k.carbs, 1]];
    return `
    <div class="facts mono">
        <div class="fact fact-head"><span>КБЖУ</span><span>100 г</span><span>${pack ? esc(pack.label) : ''}</span></div>
        ${rows.map(([label, value, digits]) => `<div class="fact"><span>${label}</span><span>${value}</span><span>${perPack(value, digits)}</span></div>`).join('')}
    </div>`;
};

const renderProductControl = () => {
    const p = productById.get(state.productId);
    const box = $('#product-control');
    const qty = state.cart[p.id];
    const qtyEl = $('.qty', box);
    if (qty && qtyEl) {
        qtyEl.textContent = qty;
        popQty(box);
        return;
    }
    let html = `<button type="button" class="buy" data-action="inc">В корзину</button>`;
    if (p.outOfStock) html = '<div class="out-note">Нет в наличии</div>';
    else if (qty) html = stepperHtml(p, '', `<span class="qty mono">${qty}</span>`);
    replaceKeepingFocus(box, html);
};

const openProduct = (id) => {
    const p = productById.get(id);
    if (!p) return;
    state.productId = id;
    state.gallery = [...p.images];
    state.galleryIndex = 0;
    renderGallery();

    const discount = hasDiscount(p);
    $('#product-name').textContent = p.name;
    $('#product-size').textContent = p.desc;
    $('#product-price').textContent = formatPrice(p.price);
    $('#product-old').textContent = discount ? formatPrice(p.oldprice) : '';
    $('#product-text').textContent = p.fullDesc || p.desc;
    $('#product-facts').innerHTML = factsHtml(p);
    $('#product').dataset.id = id;
    $('#product').classList.toggle('is-sale', discount);
    $('#product').scrollTop = 0;
    renderProductControl();
    openOverlay('product', $('#product-close'));
};

// --- фото: загрузка, запасные снимки, смена по таймеру ---

const markBroken = (id, src) => {
    if (!brokenImages.has(id)) brokenImages.set(id, new Set());
    brokenImages.get(id).add(src);
};

const workingImages = (p) => p.images.filter((src) => !brokenImages.get(p.id)?.has(src));

const handleCardImageError = (img) => {
    const id = +img.closest('.card').dataset.id;
    const product = productById.get(id);
    markBroken(id, img.getAttribute('src'));
    const next = workingImages(product)[0];
    if (next) img.src = next;
    else img.parentElement.classList.add('is-failed');
};

// Нерабочее фото убираем из галереи
const handleGalleryError = () => {
    if (state.gallery.length < 2) return;
    state.gallery.splice(state.galleryIndex, 1);
    state.galleryIndex = Math.min(state.galleryIndex, state.gallery.length - 1);
    renderGallery();
};

const rotateCardImages = () => {
    if (document.hidden) return;
    $$('.card').forEach((card) => {
        const box = card.getBoundingClientRect();
        if (box.bottom < 0 || box.top > innerHeight) return;
        const product = productById.get(+card.dataset.id);
        const urls = workingImages(product);
        if (urls.length < 2) return;
        const img = $('.photo img', card);
        const next = urls[(urls.indexOf(img.getAttribute('src')) + 1) % urls.length];
        const preload = new Image();
        preload.onload = () => {
            img.src = next;
            if (!calm()) img.animate([{ opacity: .3 }, { opacity: 1 }], { duration: 300, easing: EASE });
        };
        preload.onerror = () => markBroken(product.id, next);
        preload.src = next;
    });
};

// --- тема ---

const applyTheme = (theme) => {
    document.documentElement.dataset.theme = theme;
    $('meta[name="theme-color"]').content = THEME_COLORS[theme];
    $('#theme-toggle').setAttribute('aria-label', theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему');
};

const savedTheme = () => {
    try {
        return localStorage.getItem('theme');
    } catch {
        return null;
    }
};

// Новая тема раскрывается кругом от кнопки
const toggleTheme = (button) => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    try {
        localStorage.setItem('theme', next);
    } catch { /* приватный режим: тема живёт до перезагрузки */ }

    if (!document.startViewTransition || calm()) return applyTheme(next);
    const box = button.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    document.startViewTransition(() => applyTheme(next)).ready.then(() => {
        document.documentElement.animate(
            { clipPath: [`circle(0 at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
            { duration: 520, easing: EASE, pseudoElement: '::view-transition-new(root)' }
        );
    });
};

// --- события ---

const actions = {
    inc: (el, id) => changeQty(id, 1, el),
    dec: (el, id) => changeQty(id, -1, el),
    'open-product': (el, id) => openProduct(id),
    'close-product': () => closeOverlay('product'),
    'toggle-cart': () => (state.overlays.cart ? closeOverlay('cart') : isPhone() && openCart()),
    'close-cart': () => closeOverlay('cart'),
    'ask-clear': () => openOverlay('confirm', $('#confirm-cancel')),
    'cancel-clear': () => closeOverlay('confirm'),
    'do-clear': () => {
        clearCart();
        closeOverlay('confirm');
        closeOverlay('product');
        closeOverlay('cart');
    },
    'copy-sum': copySum,
    'copy-card': () => copyValue('card', CARD_NUMBER, 'Номер карты скопирован'),
    'theme': toggleTheme,
    'category': (el) => {
        const id = el.dataset.category;
        state.category = state.category === id ? 'all' : id;
        renderCategories();
        renderProducts();
    },
    'reset-filters': () => {
        state.query = '';
        state.category = 'all';
        $('#search').value = '';
        renderCategories();
        renderProducts();
    },
    'gallery-prev': () => stepGallery(-1),
    'gallery-next': () => stepGallery(1),
    'gallery-go': (el) => {
        state.galleryIndex = +el.dataset.index;
        renderGallery();
    }
};

// CLICK открывается сразу с суммой в буфере: остаётся только вставить её
const payWithClick = async (event, link) => {
    const total = cartTotal();
    if (total === 0) return;
    event.preventDefault();
    await copyValue('sum', String(total), 'Сумма скопирована, открываем CLICK');
    location.href = link.href;
};

const enableSheetSwipe = (handle, close) => {
    const sheet = handle.closest('.sheet');
    let startY = null;
    handle.addEventListener('touchstart', (e) => {
        startY = e.touches[0].clientY;
        sheet.classList.add('is-dragging');
    }, { passive: true });
    handle.addEventListener('touchmove', (e) => {
        if (startY === null) return;
        sheet.style.transform = `translateY(${Math.max(0, e.touches[0].clientY - startY)}px)`;
    }, { passive: true });
    const end = (e) => {
        if (startY === null) return;
        const distance = (e.changedTouches?.[0]?.clientY ?? startY) - startY;
        startY = null;
        sheet.classList.remove('is-dragging');
        sheet.style.transform = '';
        if (distance > 80) close();
    };
    handle.addEventListener('touchend', end);
    handle.addEventListener('touchcancel', end);
};

const enableGallerySwipe = () => {
    const gallery = $('#product-gallery');
    let startX = null;
    gallery.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
    gallery.addEventListener('touchend', (e) => {
        if (startX === null) return;
        const distance = e.changedTouches[0].clientX - startX;
        startX = null;
        if (Math.abs(distance) > 40) stepGallery(distance < 0 ? 1 : -1);
    });
};

const bindEvents = () => {
    document.addEventListener('click', (event) => {
        const el = event.target.closest('[data-action]');
        if (el) actions[el.dataset.action]?.(el, +el.closest('[data-id]')?.dataset.id);
    });
    $('#pay-click').addEventListener('click', (event) => payWithClick(event, event.currentTarget));

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        const top = ['confirm', 'product', 'cart'].find((name) => state.overlays[name]);
        if (top) closeOverlay(top);
    });

    // load и error не всплывают, поэтому ловим их на фазе перехвата
    document.addEventListener('load', (event) => {
        if (event.target.matches?.('.photo img')) event.target.parentElement.classList.add('is-ready');
    }, true);
    document.addEventListener('error', (event) => {
        if (event.target.matches?.('.photo img')) handleCardImageError(event.target);
        else if (event.target.id === 'product-img') handleGalleryError();
    }, true);

    let searchTimer;
    $('#search').addEventListener('input', (event) => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            state.query = event.target.value;
            renderProducts();
        }, SEARCH_DELAY_MS);
    });
    $('#sort').addEventListener('change', (event) => {
        state.sort = event.target.value;
        event.target.parentElement.classList.toggle('is-active', state.sort !== 'default');
        renderProducts();
    });

    // колесо мыши листает категории вбок
    const chips = $('#categories');
    chips.addEventListener('wheel', (event) => {
        if (chips.scrollWidth <= chips.clientWidth || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
        event.preventDefault();
        chips.scrollLeft += event.deltaY;
    }, { passive: false });

    enableSheetSwipe($('#cart-handle'), () => closeOverlay('cart'));
    enableSheetSwipe($('#product-handle'), () => closeOverlay('product'));
    enableGallerySwipe();

    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
        if (!savedTheme()) applyTheme(event.matches ? 'dark' : 'light');
    });
    matchMedia('(max-width: 999px)').addEventListener('change', syncOverlays);
};

const init = () => {
    applyTheme(document.documentElement.dataset.theme);
    renderCategories();
    renderProducts();
    renderCart();
    renderPay();
    bindEvents();
    setInterval(rotateCardImages, ROTATE_MS);
};

init();
