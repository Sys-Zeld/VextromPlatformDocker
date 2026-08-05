(function () {
  var rafToken = null;
  var resizeTimer = null;
  var isFirstRunDone = false;
  var FOOTER_CLEARANCE_PX = 18;

  function getContinuationLabel() {
    var doc = document.getElementById("report-pages");
    return (doc && doc.getAttribute("data-continuation-label")) || "";
  }

  function schedule(fn) {
    if (rafToken) window.cancelAnimationFrame(rafToken);
    rafToken = window.requestAnimationFrame(function () {
      rafToken = null;
      fn();
    });
  }

  function debounceRun() {
    if (resizeTimer) window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () {
      schedule(run);
    }, 220);
  }

  function toArray(listLike) {
    return Array.prototype.slice.call(listLike || []);
  }

  function isBlankTextNode(node) {
    return node && node.nodeType === Node.TEXT_NODE && !String(node.textContent || "").trim();
  }

  function normalizeFlowForPagination(flowEl) {
    if (!flowEl) return;

    var onlyChild = flowEl.children.length === 1 ? flowEl.firstElementChild : null;
    if (onlyChild && onlyChild.tagName === "DIV" && onlyChild.classList.contains("ql-editor")) {
      while (onlyChild.firstChild) flowEl.appendChild(onlyChild.firstChild);
      flowEl.removeChild(onlyChild);
    }

    toArray(flowEl.childNodes).forEach(function (node) {
      if (isBlankTextNode(node)) {
        flowEl.removeChild(node);
        return;
      }
      if (node.nodeType === Node.TEXT_NODE) {
        var p = document.createElement("p");
        p.textContent = String(node.textContent || "").trim();
        flowEl.replaceChild(p, node);
      }
    });
  }

  function isFlowOverflowing(flowEl, pageEl) {
    if (!flowEl || !pageEl) return false;
    var maxHeight = getMaxContentHeight(pageEl, flowEl);
    if (!maxHeight) return false;
    return flowEl.scrollHeight > (maxHeight + 1);
  }

  function isPageOverflowing(pageEl) {
    if (!pageEl) return false;
    return pageEl.scrollHeight > (pageEl.clientHeight + 1);
  }

  function getMaxContentHeight(page, flowEl) {
    if (!page || !flowEl) return 0;
    var pageRect = page.getBoundingClientRect();
    var flowRect = flowEl.getBoundingClientRect();
    var styles = window.getComputedStyle(page);
    var padBottom = parseFloat(styles.paddingBottom || "0") || 0;
    var flowTop = flowRect.top - pageRect.top;
    var contentBottom = pageRect.height - padBottom;
    var footer = page.querySelector(".report-footer");
    if (footer) {
      var footerRect = footer.getBoundingClientRect();
      var footerTop = footerRect.top - pageRect.top;
      if (Number.isFinite(footerTop) && footerTop > 0) {
        // Keep a visible safety zone above the footer. Chromium can shift text
        // baselines slightly when converting the final layout to PDF; without
        // this clearance the last line may touch or cross the footer rule.
        contentBottom = Math.min(contentBottom, footerTop - FOOTER_CLEARANCE_PX);
      }
    }
    var usable = contentBottom - flowTop;
    return Math.max(0, usable);
  }

  function blockIsHeading(block) {
    if (!block || block.nodeType !== Node.ELEMENT_NODE) return false;
    return !!block.matches("h1, h2, h3, h4, h5, h6") || !!block.querySelector("h1, h2, h3, h4, h5, h6");
  }

  function blockIsTable(block) {
    if (!block || block.nodeType !== Node.ELEMENT_NODE) return false;
    return !!block.matches("table") || !!block.querySelector("table");
  }

  // Só vale tentar dividir por linhas se houver linhas de corpo para distribuir.
  // Sem isto, um "bloco tabela" sem tbody entraria em ciclo entre as funções de
  // divisão e a de mover para a próxima página.
  function tableHasSplittableRows(block) {
    if (!block || block.nodeType !== Node.ELEMENT_NODE) return false;
    var table = block.matches("table") ? block : block.querySelector("table");
    if (!table) return false;
    return table.querySelectorAll("tbody tr").length > 0;
  }

  function blockIsImage(block) {
    if (!block || block.nodeType !== Node.ELEMENT_NODE) return false;
    return !!block.querySelector("img");
  }

  function blockIsList(block) {
    if (!block || block.nodeType !== Node.ELEMENT_NODE) return false;
    return !!block.matches("ul, ol") || !!block.querySelector("ul, ol");
  }

  function blockIsParagraphLike(block) {
    if (!block || block.nodeType !== Node.ELEMENT_NODE) return false;
    var tag = String(block.tagName || "").toUpperCase();
    return tag === "P" || tag === "LI" || tag === "BLOCKQUOTE";
  }

  function blockCanSplitAsParagraph(block) {
    if (!block || block.nodeType !== Node.ELEMENT_NODE) return false;
    if (blockIsParagraphLike(block)) return true;

    var tag = String(block.tagName || "").toUpperCase();
    if (tag !== "DIV") return false;
    if (block.children.length !== 1) return false;

    var onlyChild = block.firstElementChild;
    if (!onlyChild) return false;
    var childTag = String(onlyChild.tagName || "").toUpperCase();
    return childTag === "P" || childTag === "LI" || childTag === "BLOCKQUOTE";
  }

  function getFlow(pageEl) {
    return pageEl ? pageEl.querySelector(".rich-output") : null;
  }

  function ensurePageHeader(pageEl) {
    if (!pageEl) return null;
    var contentWrap = pageEl.querySelector(".report-page-content");
    if (!contentWrap) {
      contentWrap = document.createElement("div");
      contentWrap.className = "report-page-content";
      pageEl.appendChild(contentWrap);
    }
    var title = contentWrap.querySelector(".section-title");
    if (!title) {
      title = document.createElement("div");
      title.className = "section-title";
      var number = document.createElement("span");
      number.className = "section-title-number";
      var rich = document.createElement("div");
      rich.className = "report-section-title-rich";
      title.appendChild(number);
      title.appendChild(rich);
      contentWrap.insertBefore(title, contentWrap.firstChild || null);
    }
    return title;
  }

  function setPageHeader(pageEl, sectionMeta, isContinuation) {
    var title = ensurePageHeader(pageEl);
    if (!title) return;
    title.classList.toggle("section-title-continued", Boolean(isContinuation));

    var numberEl = title.querySelector(".section-title-number");
    if (numberEl) numberEl.textContent = isContinuation ? "" : String(sectionMeta && sectionMeta.numberLabel ? sectionMeta.numberLabel : "");

    var richTitleEl = title.querySelector(".report-section-title-rich");
    if (richTitleEl) {
      if (isContinuation) {
        richTitleEl.textContent = getContinuationLabel();
      } else {
        richTitleEl.innerHTML = String(sectionMeta && sectionMeta.titleHtml ? sectionMeta.titleHtml : "CAPITULO");
      }
    }
  }

  function buildInlineSectionHeader(sectionMeta) {
    var header = document.createElement("div");
    header.className = "section-title";

    var number = document.createElement("span");
    number.className = "section-title-number";
    number.textContent = String(sectionMeta && sectionMeta.numberLabel ? sectionMeta.numberLabel : "");
    header.appendChild(number);

    var rich = document.createElement("div");
    rich.className = "report-section-title-rich";
    rich.innerHTML = String(sectionMeta && sectionMeta.titleHtml ? sectionMeta.titleHtml : "CAPITULO");
    header.appendChild(rich);

    return header;
  }

  function cloneOverflowPage(sourcePage, sourceTopbar, sectionMeta, options) {
    var opts = options || {};
    var isContinuation = Boolean(opts.continuation);
    var overflowPage = sourcePage.cloneNode(false);
    overflowPage.removeAttribute("id");
    overflowPage.setAttribute("data-generated-overflow", "true");
    overflowPage.setAttribute("data-auto-paginate", "true");
    overflowPage.setAttribute("data-page-section-anchor", String(sectionMeta && sectionMeta.anchorId ? sectionMeta.anchorId : ""));
    overflowPage.setAttribute("data-page-section-continued", isContinuation ? "true" : "false");

    var topbar = sourceTopbar ? sourceTopbar.cloneNode(true) : document.createElement("div");
    var contentWrap = document.createElement("div");
    contentWrap.className = "report-page-content";

    var title = document.createElement("div");
    title.className = "section-title";
    if (isContinuation) title.classList.add("section-title-continued");

    var numberEl = document.createElement("span");
    numberEl.className = "section-title-number";
    numberEl.textContent = isContinuation ? "" : String(sectionMeta && sectionMeta.numberLabel ? sectionMeta.numberLabel : "");
    title.appendChild(numberEl);

    var richTitleEl = document.createElement("div");
    richTitleEl.className = "report-section-title-rich";
    if (isContinuation) {
      richTitleEl.textContent = getContinuationLabel();
    } else {
      richTitleEl.innerHTML = String(sectionMeta && sectionMeta.titleHtml ? sectionMeta.titleHtml : "CAPITULO");
    }
    title.appendChild(richTitleEl);

    var flow = document.createElement("div");
    flow.className = "rich-output";

    contentWrap.appendChild(title);
    contentWrap.appendChild(flow);
    overflowPage.appendChild(topbar);
    overflowPage.appendChild(contentWrap);

    var sourceFooter = sourcePage ? sourcePage.querySelector(".report-footer") : null;
    if (sourceFooter) {
      overflowPage.appendChild(sourceFooter.cloneNode(true));
    }

    return overflowPage;
  }

  function getBaseSectionPages(reportDoc) {
    return toArray(reportDoc.querySelectorAll(".report-page[data-auto-paginate='true']:not([data-generated-overflow='true'])"));
  }

  function ensureSourceSnapshot(page) {
    if (!page) return;
    if (page.getAttribute("data-pagination-source-cached") === "true") return;

    var title = page.querySelector(".section-title");
    var flow = getFlow(page);
    page.setAttribute("data-pagination-source-cached", "true");
    page.setAttribute("data-source-title-html", title ? title.innerHTML : "");
    page.setAttribute("data-source-flow-html", flow ? flow.innerHTML : "");
  }

  function restoreSourceSnapshot(page) {
    if (!page) return;
    ensureSourceSnapshot(page);

    var title = page.querySelector(".section-title");
    var flow = getFlow(page);
    var titleHtml = page.getAttribute("data-source-title-html") || "";
    var flowHtml = page.getAttribute("data-source-flow-html") || "";
    if (title) title.innerHTML = titleHtml;
    if (flow) flow.innerHTML = flowHtml;
  }

  function ensureNextPageForSection(currentPage, reportDoc, sectionMeta, isContinuation) {
    var topbar = currentPage.querySelector(".topbar");
    var created = cloneOverflowPage(currentPage, topbar, sectionMeta, { continuation: Boolean(isContinuation) });
    currentPage.after(created);
    return created;
  }

  function ensureImageSizeForPage(block, pageEl) {
    if (!block || !pageEl) return;
    var flow = getFlow(pageEl);
    if (!flow) return;

    var totalHeight = getMaxContentHeight(pageEl, flow);
    var usedHeight = flow.scrollHeight;
    var remaining = totalHeight - usedHeight;
    var maxHeight = Math.max(120, remaining - 10);
    toArray(block.querySelectorAll("img.report-inline-image")).forEach(function (img) {
      img.style.width = "250px";
      img.style.height = Math.min(250, maxHeight) + "px";
      img.style.objectFit = "cover";
    });
  }

  function appendAndCheck(block, pageEl) {
    var flow = getFlow(pageEl);
    if (!flow) return false;
    flow.appendChild(block);
    return !isFlowOverflowing(flow, pageEl) && !isPageOverflowing(pageEl);
  }

  function removeFromFlow(block, pageEl) {
    var flow = getFlow(pageEl);
    if (!flow || !block || block.parentNode !== flow) return;
    flow.removeChild(block);
  }

  function findParagraphTarget(block) {
    if (!block || block.nodeType !== Node.ELEMENT_NODE) return null;
    if (block.matches("p, li")) return block;
    return block.querySelector("p, li");
  }

  function collectTextNodes(root) {
    if (!root) return [];
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var nodes = [];
    var current = walker.nextNode();
    while (current) {
      nodes.push(current);
      current = walker.nextNode();
    }
    return nodes;
  }

  function getTotalTextLength(root) {
    var nodes = collectTextNodes(root);
    var total = 0;
    for (var i = 0; i < nodes.length; i += 1) {
      total += String(nodes[i].textContent || "").length;
    }
    return total;
  }

  function locateTextPosition(root, index) {
    var nodes = collectTextNodes(root);
    if (!nodes.length) return null;

    var total = 0;
    for (var i = 0; i < nodes.length; i += 1) {
      total += String(nodes[i].textContent || "").length;
    }

    var bounded = Math.max(0, Math.min(Number(index) || 0, total));
    var offset = bounded;
    for (var j = 0; j < nodes.length; j += 1) {
      var text = String(nodes[j].textContent || "");
      var len = text.length;
      if (offset <= len) return { node: nodes[j], offset: offset };
      offset -= len;
    }

    var last = nodes[nodes.length - 1];
    return { node: last, offset: String(last.textContent || "").length };
  }

  function sliceRichHtml(root, start, end) {
    var startPos = locateTextPosition(root, start);
    var endPos = locateTextPosition(root, end);
    if (!startPos || !endPos) return "";

    var range = document.createRange();
    range.setStart(startPos.node, startPos.offset);
    range.setEnd(endPos.node, endPos.offset);

    var container = document.createElement("div");
    container.appendChild(range.cloneContents());
    return container.innerHTML;
  }

  function hasVisibleText(root) {
    if (!root) return false;
    return String(root.textContent || "").replace(/\s+/g, "").length > 0;
  }

  function splitParagraphBlock(block, pageEl, reportDoc, sectionMeta) {
    var target = findParagraphTarget(block);
    if (!target) return moveWholeBlockToNextPage(block, pageEl, reportDoc, sectionMeta);
    if (!hasVisibleText(target)) return pageEl;

    var totalLength = getTotalTextLength(target);
    if (!totalLength) return moveWholeBlockToNextPage(block, pageEl, reportDoc, sectionMeta);

    var firstPart = block.cloneNode(true);
    var firstTarget = findParagraphTarget(firstPart);
    if (!firstTarget) return moveWholeBlockToNextPage(block, pageEl, reportDoc, sectionMeta);

    firstTarget.innerHTML = "";
    appendAndCheck(firstPart, pageEl);

    var low = 1;
    var high = totalLength;
    var best = 0;
    while (low <= high) {
      var mid = Math.floor((low + high) / 2);
      firstTarget.innerHTML = sliceRichHtml(target, 0, mid);
      var fit = !isFlowOverflowing(getFlow(pageEl), pageEl) && !isPageOverflowing(pageEl);
      if (fit) {
        best = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    if (best === 0) {
      removeFromFlow(firstPart, pageEl);
      return moveWholeBlockToNextPage(block, pageEl, reportDoc, sectionMeta);
    }

    firstTarget.innerHTML = sliceRichHtml(target, 0, best);
    var remainingHtml = sliceRichHtml(target, best, totalLength);
    if (!String(remainingHtml || "").replace(/<[^>]*>/g, "").trim()) return pageEl;

    var rest = block.cloneNode(true);
    var restTarget = findParagraphTarget(rest);
    if (!restTarget) return pageEl;
    restTarget.innerHTML = remainingHtml;
    var nextPage = ensureNextPageForSection(pageEl, reportDoc, sectionMeta, true);
    return appendBlockWithPagination(rest, nextPage, reportDoc, null, sectionMeta);
  }

  function splitListBlock(block, pageEl, reportDoc, sectionMeta) {
    var list = block.matches("ul, ol") ? block : block.querySelector("ul, ol");
    if (!list) return moveWholeBlockToNextPage(block, pageEl, reportDoc, sectionMeta);

    var items = toArray(list.children);
    if (!items.length) return pageEl;

    var currentPage = pageEl;
    var start = 0;

    while (start < items.length) {
      var chunk = block.cloneNode(true);
      var chunkList = chunk.matches("ul, ol") ? chunk : chunk.querySelector("ul, ol");
      if (!chunkList) return currentPage;
      chunkList.innerHTML = "";
      appendAndCheck(chunk, currentPage);

      var used = 0;
      while (start + used < items.length) {
        chunkList.appendChild(items[start + used].cloneNode(true));
        if (isFlowOverflowing(getFlow(currentPage), currentPage) || isPageOverflowing(currentPage)) {
          chunkList.removeChild(chunkList.lastElementChild);
          break;
        }
        used += 1;
      }

      if (used === 0) {
        removeFromFlow(chunk, currentPage);
        currentPage = ensureNextPageForSection(currentPage, reportDoc, sectionMeta, true);
        var forced = block.cloneNode(true);
        var forcedList = forced.matches("ul, ol") ? forced : forced.querySelector("ul, ol");
        if (!forcedList) return currentPage;
        forcedList.innerHTML = items[start].outerHTML;
        appendAndCheck(forced, currentPage);
        start += 1;
      } else {
        start += used;
        if (start < items.length) currentPage = ensureNextPageForSection(currentPage, reportDoc, sectionMeta, true);
      }
    }
    return currentPage;
  }

  function splitTableBlock(block, pageEl, reportDoc, sectionMeta) {
    var table = block.matches("table") ? block : block.querySelector("table");
    if (!table) return moveWholeBlockToNextPage(block, pageEl, reportDoc, sectionMeta);

    if (!block.matches("table") && block.querySelectorAll("table").length > 1) {
      return splitRichBlockByChildren(block, pageEl, reportDoc, sectionMeta);
    }

    var rows = toArray(table.querySelectorAll("tbody tr"));
    if (!rows.length) return moveWholeBlockToNextPage(block, pageEl, reportDoc, sectionMeta);

    // Nós após a tabela dentro do wrapper (ex: Observações, label "Tabela 4.1").
    // Devem aparecer apenas depois da última linha, nunca repetidos em cada chunk.
    var isWrapper = !block.matches("table");
    var postTableNodes = [];
    if (isWrapper) {
      var pastTable = false;
      toArray(block.childNodes).forEach(function (node) {
        if (pastTable) { postTableNodes.push(node); return; }
        if (node === table ||
            (node.nodeType === Node.ELEMENT_NODE && node.contains && node.contains(table))) {
          pastTable = true;
        }
      });
    }

    // Linha de título: única célula com colspan > 1 (ex: "MONITORAMENTO TEMPERATURA/UMIDADE").
    // Em páginas de continuação essa linha é suprimida para evitar repetição visual.
    function isTitleRow(row) {
      var cells = toArray(row.querySelectorAll("th, td"));
      return cells.length === 1 && parseInt(String(cells[0].getAttribute("colspan") || "1"), 10) > 1;
    }

    function removeTitleRows(tableEl) {
      var thead = tableEl ? tableEl.querySelector("thead") : null;
      if (!thead) return;
      toArray(thead.querySelectorAll("tr")).forEach(function (row) {
        if (isTitleRow(row)) thead.removeChild(row);
      });
    }

    function removeCaption(tableEl) {
      if (!tableEl) return;
      var cap = tableEl.querySelector("caption");
      if (cap) cap.parentNode.removeChild(cap);
    }

    function removeContinuationHeaders(tableEl) {
      removeTitleRows(tableEl);
      removeCaption(tableEl);
    }

    // Constrói um chunk sem os nós pós-tabela e com tbody vazio.
    // isFirst=true → thead completo; isFirst=false → suprime título e caption.
    function makeChunk(isFirst) {
      if (!isWrapper) {
        var c = block.cloneNode(true);
        var ct = c.matches("table") ? c : c.querySelector("table");
        var cb = ct ? ct.querySelector("tbody") : null;
        if (cb) cb.innerHTML = "";
        if (!isFirst) removeContinuationHeaders(ct);
        return { el: c, body: cb };
      }
      var c = block.cloneNode(false);
      toArray(block.childNodes).forEach(function (node) {
        if (postTableNodes.indexOf(node) !== -1) return;
        if (node === table ||
            (node.nodeType === Node.ELEMENT_NODE && node.contains && node.contains(table))) {
          var nodeClone = node.cloneNode(true);
          var innerTbody = nodeClone.querySelector("tbody");
          if (innerTbody) innerTbody.innerHTML = "";
          if (!isFirst) removeContinuationHeaders(nodeClone.matches && nodeClone.matches("table") ? nodeClone : nodeClone.querySelector("table"));
          c.appendChild(nodeClone);
          return;
        }
        c.appendChild(node.cloneNode(true));
      });
      var ct = c.querySelector("table");
      var cb = ct ? ct.querySelector("tbody") : null;
      return { el: c, body: cb };
    }

    // Adiciona linhas ao tbody enquanto não há overflow. Retorna quantas couberam.
    function fillRows(body, page, startIdx) {
      var used = 0;
      while (startIdx + used < rows.length) {
        body.appendChild(rows[startIdx + used].cloneNode(true));
        if (isFlowOverflowing(getFlow(page), page) || isPageOverflowing(page)) {
          body.removeChild(body.lastElementChild);
          break;
        }
        used += 1;
      }
      return used;
    }

    function appendPostNodes(page) {
      for (var i = 0; i < postTableNodes.length; i++) {
        var n = postTableNodes[i];
        if (isBlankTextNode(n)) continue;
        page = appendBlockWithPagination(n.cloneNode(true), page, reportDoc, null, sectionMeta);
      }
      return page;
    }

    var currentPage = pageEl;
    var rowIndex = 0;

    while (rowIndex < rows.length) {
      var built = makeChunk(rowIndex === 0);
      if (!built.el || !built.body) return currentPage;
      appendAndCheck(built.el, currentPage);

      var used = fillRows(built.body, currentPage, rowIndex);

      if (used === 0) {
        // Nenhuma linha coube: remove chunk vazio, cria nova página e força a primeira linha.
        // Continua preenchendo linhas no mesmo chunk forçado para evitar cabeçalho duplo.
        removeFromFlow(built.el, currentPage);
        currentPage = ensureNextPageForSection(currentPage, reportDoc, sectionMeta, true);
        var forced = makeChunk(false);
        if (!forced.body) return currentPage;
        forced.body.appendChild(rows[rowIndex].cloneNode(true));
        appendAndCheck(forced.el, currentPage);
        rowIndex += 1;
        var forcedUsed = fillRows(forced.body, currentPage, rowIndex);
        rowIndex += forcedUsed;
        if (rowIndex >= rows.length) {
          currentPage = appendPostNodes(currentPage);
        } else {
          currentPage = ensureNextPageForSection(currentPage, reportDoc, sectionMeta, true);
        }
      } else {
        rowIndex += used;
        if (rowIndex < rows.length) {
          currentPage = ensureNextPageForSection(currentPage, reportDoc, sectionMeta, true);
        } else {
          currentPage = appendPostNodes(currentPage);
        }
      }
    }
    return currentPage;
  }

  function splitRichBlockByChildren(block, pageEl, reportDoc, sectionMeta) {
    var children = toArray(block.childNodes);
    if (!children.length) return moveWholeBlockToNextPage(block, pageEl, reportDoc, sectionMeta);

    var first = block.cloneNode(false);
    appendAndCheck(first, pageEl);

    var splitAt = 0;
    for (var i = 0; i < children.length; i += 1) {
      first.appendChild(children[i].cloneNode(true));
      if (isFlowOverflowing(getFlow(pageEl), pageEl) || isPageOverflowing(pageEl)) {
        first.removeChild(first.lastChild);
        break;
      }
      splitAt = i + 1;
    }

    if (splitAt === 0) {
      removeFromFlow(first, pageEl);

      var firstElem = null;
      for (var fi = 0; fi < children.length; fi++) {
        if (children[fi].nodeType === Node.ELEMENT_NODE) { firstElem = children[fi]; break; }
      }

      // O primeiro filho é uma tabela que não coube: divide por linhas AQUI.
      // Sem isto o bloco inteiro seria empurrado para a próxima página e, se for
      // mais alto que uma página, ficaria desenhado por cima do rodapé — a
      // .report-page tem overflow:hidden, então nada é cortado nem rolado.
      // Vale mesmo com avoid-break: preferir não quebrar não pode virar
      // "invadir o rodapé" quando não existe página que caiba o bloco.
      if (firstElem && blockIsTable(firstElem) && !blockIsImage(firstElem) && tableHasSplittableRows(firstElem)) {
        var tablePage = splitTableBlock(firstElem.cloneNode(true), pageEl, reportDoc, sectionMeta);
        var afterTable = block.cloneNode(false);
        var seenTable = false;
        for (var ti2 = 0; ti2 < children.length; ti2++) {
          if (!seenTable && children[ti2] === firstElem) { seenTable = true; continue; }
          if (seenTable) afterTable.appendChild(children[ti2].cloneNode(true));
        }
        if (afterTable.childNodes.length > 0) {
          return appendBlockWithPagination(afterTable, tablePage, reportDoc, null, sectionMeta);
        }
        return tablePage;
      }

      if (firstElem &&
          findParagraphTarget(firstElem) &&
          !blockIsImage(firstElem) &&
          !blockIsTable(firstElem) &&
          !(firstElem.classList && firstElem.classList.contains("avoid-break"))) {
        var splitPage = splitParagraphBlock(firstElem.cloneNode(true), pageEl, reportDoc, sectionMeta);
        var afterFirst = block.cloneNode(false);
        var seenFirst = false;
        for (var ai = 0; ai < children.length; ai++) {
          if (!seenFirst && children[ai] === firstElem) { seenFirst = true; continue; }
          if (seenFirst) afterFirst.appendChild(children[ai].cloneNode(true));
        }
        if (afterFirst.childNodes.length > 0) {
          return appendBlockWithPagination(afterFirst, splitPage, reportDoc, null, sectionMeta);
        }
        return splitPage;
      }

      return moveWholeBlockToNextPage(block, pageEl, reportDoc, sectionMeta);
    }

    if (splitAt >= children.length) return pageEl;

    // Se o primeiro filho não colocado contém uma tabela (sem avoid-break), tenta
    // dividi-lo por linhas na página atual antes de criar uma nova página,
    // evitando espaço desperdiçado (ex: header Alber na página N, strings na N+1).
    var firstUnplacedIdx = splitAt;
    while (firstUnplacedIdx < children.length && children[firstUnplacedIdx].nodeType !== Node.ELEMENT_NODE) {
      firstUnplacedIdx++;
    }
    var firstUnplacedEl = firstUnplacedIdx < children.length ? children[firstUnplacedIdx] : null;
    if (firstUnplacedEl && blockIsTable(firstUnplacedEl) && !blockIsImage(firstUnplacedEl) &&
        !(firstUnplacedEl.classList && firstUnplacedEl.classList.contains("avoid-break"))) {
      var afterTablePage = splitTableBlock(firstUnplacedEl.cloneNode(true), pageEl, reportDoc, sectionMeta);
      if (firstUnplacedIdx + 1 >= children.length) return afterTablePage;
      var tailRest = block.cloneNode(false);
      for (var ti = firstUnplacedIdx + 1; ti < children.length; ti += 1) tailRest.appendChild(children[ti].cloneNode(true));
      return appendBlockWithPagination(tailRest, afterTablePage, reportDoc, null, sectionMeta);
    }

    var rest = block.cloneNode(false);
    for (var j = splitAt; j < children.length; j += 1) rest.appendChild(children[j].cloneNode(true));
    var nextPage = ensureNextPageForSection(pageEl, reportDoc, sectionMeta, true);
    return appendBlockWithPagination(rest, nextPage, reportDoc, null, sectionMeta);
  }

  function inlineHeaderFitsAlone(pageEl, headingBlock) {
    var flow = getFlow(pageEl);
    if (!flow) return false;
    var probe = headingBlock.cloneNode(true);
    flow.appendChild(probe);
    var fits = !isFlowOverflowing(flow, pageEl) && !isPageOverflowing(pageEl);
    flow.removeChild(probe);
    return fits;
  }

  function moveWholeBlockToNextPage(block, pageEl, reportDoc, sectionMeta) {
    var nextPage = ensureNextPageForSection(pageEl, reportDoc, sectionMeta, true);
    ensureImageSizeForPage(block, nextPage);
    if (appendAndCheck(block, nextPage)) return nextPage;

    // Não coube nem sozinho numa página vazia. Deixá-lo aqui significaria
    // desenhá-lo por cima do rodapé. Se for uma tabela com linhas, dividir é
    // sempre possível (splitTableBlock força ao menos uma linha por página, o
    // que garante progresso e impede recursão).
    if (block.matches && block.matches("table") && tableHasSplittableRows(block) && !blockIsImage(block)) {
      removeFromFlow(block, nextPage);
      return splitTableBlock(block, nextPage, reportDoc, sectionMeta);
    }
    return nextPage;
  }

  function keepHeadingWithNext(currentPage, headingBlock, nextBlock) {
    if (!nextBlock) return true;
    var flow = getFlow(currentPage);
    if (!flow) return true;

    var headingProbe = headingBlock.cloneNode(true);
    flow.appendChild(headingProbe);
    var fitHeading = !isFlowOverflowing(flow, currentPage) && !isPageOverflowing(currentPage);

    var fitBoth = fitHeading;
    if (fitHeading) {
      var nextProbe = nextBlock.cloneNode(true);
      flow.appendChild(nextProbe);
      fitBoth = !isFlowOverflowing(flow, currentPage) && !isPageOverflowing(currentPage);
      flow.removeChild(nextProbe);
    }
    flow.removeChild(headingProbe);
    return fitBoth;
  }

  function appendBlockWithPagination(block, pageEl, reportDoc, nextBlock, sectionMeta) {
    if (!block) return pageEl;
    var currentPage = pageEl;
    var flow = getFlow(currentPage);
    if (!flow) return currentPage;

    if (block.classList && block.classList.contains("force-new-page") && flow.childElementCount > 0) {
      currentPage = ensureNextPageForSection(currentPage, reportDoc, sectionMeta, true);
      flow = getFlow(currentPage);
    }

    if (blockIsHeading(block) && !keepHeadingWithNext(currentPage, block, nextBlock) && flow.childElementCount > 0) {
      currentPage = ensureNextPageForSection(currentPage, reportDoc, sectionMeta, true);
      flow = getFlow(currentPage);
    }

    ensureImageSizeForPage(block, currentPage);
    var fit = appendAndCheck(block, currentPage);
    if (fit) return currentPage;

    removeFromFlow(block, currentPage);

    if ((block.classList && block.classList.contains("avoid-break")) || blockIsImage(block)) {
      if (blockIsTable(block) && !blockIsImage(block)) {
        // Tabela não coube inteira: tenta iniciar na página atual por linhas.
        // splitTableBlock lida com o caso de 0 linhas caberem (cria nova página automaticamente).
        return splitTableBlock(block, currentPage, reportDoc, sectionMeta);
      }
      return moveWholeBlockToNextPage(block, currentPage, reportDoc, sectionMeta);
    }
    if (blockIsTable(block)) return splitTableBlock(block, currentPage, reportDoc, sectionMeta);
    if (blockIsList(block)) return splitListBlock(block, currentPage, reportDoc, sectionMeta);
    if (blockCanSplitAsParagraph(block) && !blockIsImage(block)) return splitParagraphBlock(block, currentPage, reportDoc, sectionMeta);
    return splitRichBlockByChildren(block, currentPage, reportDoc, sectionMeta);
  }

  function extractBlocksFromFlow(flowEl) {
    if (!flowEl) return [];
    normalizeFlowForPagination(flowEl);
    var blocks = [];
    toArray(flowEl.childNodes).forEach(function (node) {
      if (isBlankTextNode(node)) return;
      if (node.nodeType === Node.TEXT_NODE) {
        var p = document.createElement("p");
        p.textContent = String(node.textContent || "").trim();
        blocks.push(p);
        return;
      }
      blocks.push(node.cloneNode(true));
    });
    return blocks;
  }

  function moveExcessTitleToFlow(pageEl) {
    var titleRich = pageEl.querySelector(".report-section-title-rich");
    var flow = getFlow(pageEl);
    if (!titleRich || !flow) return;

    var children = toArray(titleRich.childNodes);
    var firstRealFound = false;
    var excess = [];
    for (var i = 0; i < children.length; i += 1) {
      if (!firstRealFound && !isBlankTextNode(children[i])) {
        firstRealFound = true;
        continue;
      }
      if (firstRealFound) excess.push(children[i]);
    }
    if (!excess.length) return;

    var ref = flow.firstChild;
    for (var j = 0; j < excess.length; j += 1) {
      titleRich.removeChild(excess[j]);
      if (ref) flow.insertBefore(excess[j], ref); else flow.appendChild(excess[j]);
    }
  }

  function hasFlowContent(pageEl) {
    var flow = getFlow(pageEl);
    return Boolean(flow && flow.childNodes.length);
  }

  function captureSectionsCache(reportDoc) {
    if (!reportDoc) return null;
    if (reportDoc.__paginationSectionsCache) return reportDoc.__paginationSectionsCache;

    var basePages = getBaseSectionPages(reportDoc);
    if (!basePages.length) return null;

    var sections = basePages.map(function (basePage, index) {
      restoreSourceSnapshot(basePage);
      moveExcessTitleToFlow(basePage);
      var flow = getFlow(basePage);
      var title = basePage.querySelector(".section-title");
      var numberEl = title ? title.querySelector(".section-title-number") : null;
      var richTitleEl = title ? title.querySelector(".report-section-title-rich") : null;

      return {
        anchorId: String(basePage.id || "").trim(),
        numberLabel: String(numberEl ? numberEl.textContent : (index + 1 + ".")),
        titleHtml: String(richTitleEl ? richTitleEl.innerHTML : "CAPITULO"),
        blocks: extractBlocksFromFlow(flow)
      };
    });

    var rootPage = basePages[0];
    rootPage.setAttribute("data-pagination-root", "true");

    for (var i = 1; i < basePages.length; i += 1) {
      if (basePages[i].parentNode) basePages[i].parentNode.removeChild(basePages[i]);
    }

    reportDoc.__paginationSectionsCache = {
      rootPage: rootPage,
      sections: sections
    };
    return reportDoc.__paginationSectionsCache;
  }

  function clearRenderedPagination(reportDoc, rootPage) {
    toArray(reportDoc.querySelectorAll(".report-page[data-generated-overflow='true']")).forEach(function (node) {
      if (node.parentNode) node.parentNode.removeChild(node);
    });
    if (!rootPage) return;
    rootPage.removeAttribute("id");
    rootPage.removeAttribute("data-page-section-anchor");
    rootPage.removeAttribute("data-page-section-continued");
    var flow = getFlow(rootPage);
    if (flow) flow.innerHTML = "";
  }

  function repaginateSections(reportDoc) {
    if (!reportDoc) return;
    var cache = captureSectionsCache(reportDoc);
    if (!cache || !cache.rootPage || !Array.isArray(cache.sections) || !cache.sections.length) return;

    var rootPage = cache.rootPage;
    clearRenderedPagination(reportDoc, rootPage);

    var currentPage = rootPage;
    var firstSection = cache.sections[0];
    setPageHeader(currentPage, firstSection, false);
    if (firstSection.anchorId) currentPage.id = firstSection.anchorId;
    currentPage.setAttribute("data-page-section-anchor", firstSection.anchorId || "");
    currentPage.setAttribute("data-page-section-continued", "false");

    for (var sectionIdx = 0; sectionIdx < cache.sections.length; sectionIdx += 1) {
      var sectionMeta = cache.sections[sectionIdx];
      var blocks = Array.isArray(sectionMeta.blocks) ? sectionMeta.blocks : [];

      if (sectionIdx > 0) {
        if (!hasFlowContent(currentPage)) {
          setPageHeader(currentPage, sectionMeta, false);
          currentPage.removeAttribute("id");
          if (sectionMeta.anchorId) currentPage.id = sectionMeta.anchorId;
          currentPage.setAttribute("data-page-section-anchor", sectionMeta.anchorId || "");
          currentPage.setAttribute("data-page-section-continued", "false");
        } else {
          var inlineHeader = buildInlineSectionHeader(sectionMeta);
          var canStay = inlineHeaderFitsAlone(currentPage, inlineHeader);
          if (!canStay) {
            currentPage = ensureNextPageForSection(currentPage, reportDoc, sectionMeta, false);
            if (sectionMeta.anchorId) currentPage.id = sectionMeta.anchorId;
          } else {
            if (sectionMeta.anchorId) inlineHeader.id = sectionMeta.anchorId;
            appendAndCheck(inlineHeader, currentPage);
          }
        }
      }

      for (var blockIdx = 0; blockIdx < blocks.length; blockIdx += 1) {
        var current = blocks[blockIdx].cloneNode(true);
        var next = blocks[blockIdx + 1] ? blocks[blockIdx + 1].cloneNode(true) : null;
        currentPage = appendBlockWithPagination(current, currentPage, reportDoc, next, sectionMeta);
      }
    }
  }

  function updateTocPages(reportDoc) {
    if (!reportDoc) return;
    var pages = toArray(reportDoc.querySelectorAll(".report-page"));

    toArray(reportDoc.querySelectorAll(".report-toc li")).forEach(function (item) {
      var titleLink = item.querySelector(".report-toc-title, .report-toc-link");
      var pageLink = item.querySelector(".report-toc-page");
      if (!titleLink || !pageLink) return;
      var href = String(titleLink.getAttribute("href") || "");
      if (!href || href.charAt(0) !== "#") return;
      var anchorId = href.slice(1);
      if (!anchorId) return;

      var anchorEl = document.getElementById(anchorId);
      if (!anchorEl) return;
      var pageEl = anchorEl.closest(".report-page");
      if (!pageEl) return;
      var pageNumber = pages.indexOf(pageEl) + 1;
      if (pageNumber <= 0) return;
      pageLink.textContent = String(pageNumber);
    });
  }

  function bindImageReflow(reportDoc) {
    if (!reportDoc) return;
    toArray(reportDoc.querySelectorAll("img")).forEach(function (img) {
      if (img.complete) return;
      img.addEventListener("load", debounceRun, { once: true });
      img.addEventListener("error", debounceRun, { once: true });
    });
  }

  function run() {
    var reportDoc = document.querySelector(".report-doc");
    if (!isFirstRunDone) {
      isFirstRunDone = true;
      document.dispatchEvent(new CustomEvent("reportPaginationReady"));
    }
    if (!reportDoc) {
      window.__reportPaginationDone = true;
      return;
    }
    repaginateSections(reportDoc);
    updateTocPages(reportDoc);
    bindImageReflow(reportDoc);
    window.__reportPaginationDone = true;
  }

  function waitForAllResources() {
    var images = toArray(document.querySelectorAll("img"));
    var imagePromises = images.map(function (img) {
      if (img.complete && img.naturalWidth !== 0) return Promise.resolve();
      return new Promise(function (resolve) {
        img.addEventListener("load", resolve, { once: true });
        img.addEventListener("error", resolve, { once: true });
      });
    });

    var fontPromise = (document.fonts && document.fonts.ready)
      ? document.fonts.ready.then(function () {}, function () {})
      : Promise.resolve();

    var timeout = new Promise(function (resolve) {
      window.setTimeout(resolve, 5000);
    });

    return Promise.race([Promise.all(imagePromises.concat([fontPromise])), timeout]);
  }

  function initPagination() {
    // Garante que a classe de loading está ativa mesmo sem o controller inline.
    // O CSS de report-preview.css usa html.report-paginating para mostrar o spinner
    // e suprimir o report-doc (opacity:0). A classe é removida quando reportPaginationReady
    // dispara (lógica no controller), ativando o fade-in via transition.
    if (!document.documentElement.classList.contains("report-paginating")) {
      document.documentElement.classList.add("report-paginating");
    }

    waitForAllResources().then(function () {
      schedule(run);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPagination);
  } else {
    initPagination();
  }

  window.addEventListener("resize", function () {
    debounceRun();
  });
})();
