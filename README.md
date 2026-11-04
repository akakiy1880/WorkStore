# 🛒 [Офис Маркет: Self-Service Kiosk](https://akakiy1880.github.io/WorkStore/)

Простой и удобный веб-интерфейс для самообслуживания в офисных мини-маркетах (так называемых "Honesty/Self-service Stores").

Сайт содержит все необходимое: список товаров, корзину, расчет общей суммы, копирование суммы и номера карты для оплаты (перевод с карты на карту) и переход в CLICK.

<div style="display: flex; gap: 10px;">
    <img src="https://github.com/user-attachments/assets/2627ee32-5898-4687-a843-3e8d8bba0e3f" width="300">
    <img src="https://github.com/user-attachments/assets/09542964-fdd2-4d60-933f-99fb698967d2" width="300">
  </div>

## ✨ Особенности

* **Адаптивный дизайн:** На телефоне сетка в 2 колонки и лента оплаты снизу, на десктопе корзина всегда видна в правой колонке.
* **Светлая/Темная тема:** Переключение с круговым раскрытием, выбор сохраняется в `localStorage`, по умолчанию берется системная настройка.
* **Интерактивная корзина:** Увеличение/уменьшение количества товаров, автоматический расчет общей суммы.
* **Плавные анимации:** Появление карточек, полет товара к сумме, бегущая сумма, шторки. Учитывается `prefers-reduced-motion`.
* **Удобная оплата:** Сумма и номер карты копируются в одно нажатие прямо с главного экрана, кнопка CLICK сама копирует сумму перед переходом.
* **Технологии:** Чистый HTML, CSS и Vanilla JavaScript (без фреймворков и сборки).

## 🗂 Структура

* `products.js` — каталог товаров и категории. Товары правятся здесь.
* `index.html` — разметка.
* `styles.css` — оформление, цвета тем заданы переменными в начале файла.
* `app.js` — логика витрины; номер карты задан в `CARD_NUMBER`, а для показа дублируется в `index.html`.

## 🚀 Запуск проекта

Поскольку проект состоит из статических файлов без сборки, его запуск максимально прост.

### Локальный запуск

1.  Клонируйте репозиторий:
    ```bash
    git clone [https://github.com/ВАШ_НИКНЕЙМ/office-market-kiosk.git](https://github.com/ВАШ_НИКНЕЙМ/office-market-kiosk.git)
    ```
2.  Перейдите в папку проекта:
    ```bash
    cd office-market-kiosk
    ```
3.  Откройте файл `index.html` в вашем любимом веб-браузере.

### Развертывание на GitHub Pages

Этот проект автоматически развертывается на **GitHub Pages** с помощью GitHub Actions.

После пуша в ветку `main`, ваше приложение будет доступно по адресу:
`https://ВАШ_НИКНЕЙМ.github.io/office-market-kiosk/`

## ⚙️ Файлы GitHub Actions

Для автоматического развертывания проекта на GitHub Pages необходимо создать файл конфигурации в директории `.github/workflows/`.

**Файл:** `.github/workflows/deploy.yml`

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches:
      - main # Запускать при пуше в ветку main

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    permissions:
      contents: write # Требуется для пуша в репозиторий
      pages: write    # Требуется для развертывания на GitHub Pages
      id-token: write # Требуется для нового метода OIDC (рекомендуется)
      
    steps:
      - name: Checkout 🛎️
        uses: actions/checkout@v4
      
      # Поскольку это чистый HTML/CSS/JS проект, 
      # дополнительная сборка не требуется. 
      # Мы просто перемещаем файлы.

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./ # Публикуем все файлы из корня репозитория
