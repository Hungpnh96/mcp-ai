import { fetchJson } from './common.js';

const newsLatestList = document.getElementById('newsLatestList');
const newsDetail = document.getElementById('newsDetail');
const newsDetailTitle = document.getElementById('newsDetailTitle');
const newsDetailLead = document.getElementById('newsDetailLead');
const newsDetailBody = document.getElementById('newsDetailBody');
const newsDetailLink = document.getElementById('newsDetailLink');
const btnNewsLatest = document.getElementById('btnNewsLatest');

function renderNews(items) {
  if (!newsLatestList) return;
  if (!Array.isArray(items) || !items.length) {
    newsLatestList.innerHTML = '<li>Không có dữ liệu.</li>';
    return;
  }
  newsLatestList.innerHTML = items
    .map((item, idx) => `
      <li data-link="${encodeURIComponent(item?.link || '')}" data-title="${encodeURIComponent(item?.title || '')}">
        <h4>${idx + 1}. ${item?.title || 'Không tiêu đề'}</h4>
        <p>${item?.description || ''}</p>
        <small>${item?.publishedAt || ''}</small>
        <div style="margin-top:6px; display:flex; gap:8px; flex-wrap:wrap;">
          <button class="secondary" data-action="read">Đọc nhanh</button>
          <a href="${item?.link}" target="_blank" rel="noreferrer noopener">Mở VNExpress</a>
        </div>
      </li>
    `)
    .join('');

  newsLatestList.querySelectorAll('button[data-action="read"]').forEach((btn) => {
    btn.addEventListener('click', async (evt) => {
      evt.stopPropagation();
      const li = btn.closest('li');
      if (!li) return;
      const link = decodeURIComponent(li.dataset.link || '');
      const title = decodeURIComponent(li.dataset.title || '');
      if (!link) return;

      newsDetail.style.display = 'block';
      newsDetailTitle.textContent = title || 'Không tiêu đề';
      newsDetailLead.textContent = 'Đang tải nội dung...';
      newsDetailBody.innerHTML = '';
      newsDetailLink.href = link;

      try {
        const article = await fetchJson('/api/news/read', { url: link });
        newsDetailLead.textContent = article?.lead || '';
        newsDetailBody.innerHTML = (article?.content || [])
          .map((paragraph) => `<p>${paragraph}</p>`)
          .join('') || '<p>Không có nội dung.</p>';
      } catch (err) {
        newsDetailLead.textContent = `Lỗi: ${String(err)}`;
        newsDetailBody.innerHTML = '';
      }
    });
  });
}

async function loadLatestNews() {
  if (newsLatestList) newsLatestList.innerHTML = '<li>Đang tải...</li>';
  newsDetail.style.display = 'none';
  try {
    const data = await fetchJson('/api/news/latest');
    renderNews(data?.items?.slice(0, 10));
  } catch (err) {
    if (newsLatestList) newsLatestList.innerHTML = `<li>${String(err)}</li>`;
  }
}

btnNewsLatest?.addEventListener('click', loadLatestNews);

loadLatestNews();
