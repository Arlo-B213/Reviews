// Manually added reviews + photos. The site is static (GitHub Pages), so entries are kept
// in this browser's localStorage and merged into DATA_ALL at load. Photos are downscaled
// to JPEG data URIs so they fit in storage.
window.ManualReviews = (function(){
  const KEY = "manualReviews.v1";
  const MAX_PHOTO_EDGE = 1280;
  const photos = {};   // photo id -> data URI, read by the ledger's photo strip

  function readStore(){
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch(e){ return []; }
  }
  function writeStore(list){
    try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch(e){ return false; }
  }

  // Returns review objects in the same shape as DATA_ALL rows.
  function load(){
    return readStore().map(m => {
      const ids = [];
      (m.photos || []).forEach((uri, i) => { const id = m.id + "-" + i; photos[id] = uri; ids.push(id); });
      return { business:m.business, reviewer:m.reviewer, stars:m.stars, date:m.date,
               review:m.review, photos:ids, source:"Manual", _manualId:m.id };
    });
  }

  function remove(id){
    writeStore(readStore().filter(m => m.id !== id));
    location.reload();
  }

  function shrink(file){
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Couldn't read " + file.name)); };
      img.src = url;
    });
  }

  const CSS = `
    .mr-dialog{border:1px solid var(--line-strong); border-radius:var(--radius-lg); background:var(--surface); color:var(--ink);
      padding:0; width:min(520px, calc(100vw - 32px)); box-shadow:var(--shadow-lg); font-family:var(--font-body);}
    .mr-dialog::backdrop{background:rgba(10,12,16,.5);}
    .mr-form{display:flex; flex-direction:column; gap:14px; padding:22px;}
    .mr-form h3{margin:0; font-family:var(--font-display); font-size:20px;}
    .mr-form label{display:flex; flex-direction:column; gap:5px; font-size:12px; font-family:var(--font-mono); color:var(--ink-soft);}
    .mr-form input,.mr-form select,.mr-form textarea{font:inherit; font-family:var(--font-body); font-size:14px; color:var(--ink);
      background:var(--bg); border:1px solid var(--line-strong); border-radius:var(--radius-sm); padding:8px 10px;}
    .mr-form textarea{min-height:110px; resize:vertical;}
    .mr-row{display:grid; grid-template-columns:1fr 1fr; gap:12px;}
    .mr-thumbs{display:flex; gap:6px; flex-wrap:wrap;}
    .mr-thumbs img{width:56px; height:56px; object-fit:cover; border-radius:6px; border:1px solid var(--line);}
    .mr-actions{display:flex; justify-content:flex-end; gap:8px;}
    .mr-err{color:var(--critical); font-size:13px; margin:0;}
    .mr-del{margin-top:8px; font-size:11px;}
  `;

  function mount(options){
    const businesses = options.businesses;
    const style = document.createElement("style"); style.textContent = CSS; document.head.appendChild(style);

    const dlg = document.createElement("dialog");
    dlg.className = "mr-dialog";
    dlg.innerHTML = `
      <form class="mr-form" method="dialog" novalidate>
        <h3>Add a review</h3>
        <label>Restaurant
          <select name="business" required>${businesses.map(b => `<option>${b}</option>`).join("")}</select>
        </label>
        <div class="mr-row">
          <label>Reviewer name <input name="reviewer" required maxlength="80"></label>
          <label>Date <input name="date" type="date" required></label>
        </div>
        <label>Rating
          <select name="stars" required>
            <option value="5">5 ★</option><option value="4">4 ★</option><option value="3">3 ★</option>
            <option value="2">2 ★</option><option value="1">1 ★</option>
          </select>
        </label>
        <label>Review <textarea name="review" required maxlength="5000"></textarea></label>
        <label>Photos (optional) <input name="photos" type="file" accept="image/*" multiple></label>
        <div class="mr-thumbs"></div>
        <p class="mr-err" hidden></p>
        <div class="mr-actions">
          <button type="button" class="chip" data-cancel>Cancel</button>
          <button type="submit" class="chip">Save review</button>
        </div>
      </form>`;
    document.body.appendChild(dlg);

    const form = dlg.querySelector("form");
    const err = dlg.querySelector(".mr-err");
    const thumbs = dlg.querySelector(".mr-thumbs");
    const today = new Date().toISOString().slice(0, 10);
    form.date.value = today; form.date.max = today;

    form.photos.addEventListener("change", () => {
      thumbs.innerHTML = "";
      [...form.photos.files].forEach(f => {
        const im = document.createElement("img"); im.src = URL.createObjectURL(f); im.alt = ""; thumbs.appendChild(im);
      });
    });
    dlg.querySelector("[data-cancel]").addEventListener("click", () => dlg.close());

    form.addEventListener("submit", async e => {
      e.preventDefault();
      err.hidden = true;
      const fail = msg => { err.textContent = msg; err.hidden = false; };
      const reviewer = form.reviewer.value.trim(), review = form.review.value.trim();
      if(!reviewer || !review || !form.date.value) return fail("Name, date and review text are required.");
      let uris;
      try { uris = await Promise.all([...form.photos.files].map(shrink)); }
      catch(ex){ return fail(ex.message); }
      const list = readStore();
      list.push({ id:"manual-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
                  business:form.business.value, reviewer, stars:Number(form.stars.value),
                  date:form.date.value, review, photos:uris });
      if(!writeStore(list)) return fail("Browser storage is full — try fewer or smaller photos.");
      location.reload();
    });

    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "chip"; btn.textContent = "+ Add review";
    btn.addEventListener("click", () => dlg.showModal());
    options.buttonParent.insertBefore(btn, options.buttonParent.firstChild);
  }

  return { load, remove, mount, photos };
})();
