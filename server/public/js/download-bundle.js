import { DropgateClient, importKeyFromBase64, decryptFilenameFromBase64 } from './dropgate-core.js';
import { setStatusError, setStatusSuccess, StatusType, Icons, updateStatusCard } from './status-card.js';

const statusTitle = document.getElementById('status-title');
const statusMessage = document.getElementById('status-message');
const bundleDetails = document.getElementById('bundle-details');
const bundleFileCount = document.getElementById('bundle-file-count');
const bundleTotalSize = document.getElementById('bundle-total-size');
const bundleEncryption = document.getElementById('bundle-encryption');
const fileListContainer = document.getElementById('file-list-container');
const toggleFileListBtn = document.getElementById('toggle-file-list');
const fileList = document.getElementById('file-list');
const fileListItems = document.getElementById('file-list-items');
const downloadActions = document.getElementById('download-actions');
const downloadAllButton = document.getElementById('download-all-button');
const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const progressFileName = document.getElementById('progress-file-name');
const iconContainer = document.getElementById('icon-container');
const card = document.getElementById('status-card');
const encryptionStatement = document.getElementById('encryption-statement');

const client = new DropgateClient({ clientVersion: '3.0.0', server: location.origin });

const bundleState = {
  bundleId: null,
  isEncrypted: false,
  keyB64: null,
  filenames: [],
  files: [],
  totalSizeBytes: 0,
};

let fileListVisible = false;

function showError(title, message) {
  setStatusError({
    card,
    iconContainer,
    titleEl: statusTitle,
    messageEl: statusMessage,
    title,
    message,
  });
  downloadActions.style.display = 'none';
  progressContainer.style.display = 'none';
  fileListContainer.style.display = 'none';
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '0 bytes';
  if (bytes === 0) return '0 bytes';
  const k = 1000;
  const sizes = ['bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const v = bytes / Math.pow(k, i);
  return `${v.toFixed(v < 10 && i > 0 ? 2 : 1)} ${sizes[i]}`;
}

function toggleFileList() {
  fileListVisible = !fileListVisible;
  fileList.style.display = fileListVisible ? 'block' : 'none';
  toggleFileListBtn.innerHTML = fileListVisible
    ? '<span class="material-icons-round" style="font-size: 1rem; vertical-align: middle;">expand_less</span> Hide files'
    : '<span class="material-icons-round" style="font-size: 1rem; vertical-align: middle;">expand_more</span> Show files';
}

function buildFileList() {
  fileListItems.innerHTML = '';
  for (let i = 0; i < bundleState.filenames.length; i++) {
    const name = bundleState.filenames[i];
    const size = bundleState.files[i].sizeBytes;
    const fileId = bundleState.files[i].fileId;

    const li = document.createElement('li');
    li.className = 'list-group-item d-flex justify-content-between align-items-center py-2';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'text-truncate me-2';
    nameSpan.textContent = name;
    nameSpan.title = name;

    const rightSide = document.createElement('span');
    rightSide.className = 'd-flex align-items-center gap-2 flex-shrink-0';

    const sizeSpan = document.createElement('span');
    sizeSpan.className = 'text-body-secondary small';
    sizeSpan.textContent = formatBytes(size);
    rightSide.appendChild(sizeSpan);

    // Individual download button (only for non-encrypted files in non-secure context,
    // or any file where we can stream)
    if (!bundleState.isEncrypted) {
      const dlBtn = document.createElement('a');
      dlBtn.href = `/api/file/${fileId}`;
      dlBtn.className = 'btn btn-sm btn-outline-primary';
      dlBtn.title = `Download ${name}`;
      dlBtn.innerHTML = '<span class="material-icons-round" style="font-size: 1rem;">download</span>';
      rightSide.appendChild(dlBtn);
    } else if (window.isSecureContext && window.streamSaver?.createWriteStream) {
      const dlBtn = document.createElement('button');
      dlBtn.className = 'btn btn-sm btn-outline-primary';
      dlBtn.title = `Download ${name}`;
      dlBtn.innerHTML = '<span class="material-icons-round" style="font-size: 1rem;">download</span>';
      dlBtn.addEventListener('click', () => downloadSingleFile(i));
      rightSide.appendChild(dlBtn);
    }

    li.appendChild(nameSpan);
    li.appendChild(rightSide);
    fileListItems.appendChild(li);
  }
}

async function downloadSingleFile(index) {
  const name = bundleState.filenames[index];
  const fileId = bundleState.files[index].fileId;

  if (!bundleState.isEncrypted) {
    // Direct download for unencrypted files
    window.location.href = `/api/file/${fileId}`;
    return;
  }

  // Encrypted single-file download via streamSaver
  if (!window.isSecureContext || !window.streamSaver?.createWriteStream) {
    alert('Encrypted files require a secure context (HTTPS) to download.');
    return;
  }

  try {
    const fileStream = streamSaver.createWriteStream(name);
    const writer = fileStream.getWriter();

    await client.downloadFiles({
      fileId,
      keyB64: bundleState.keyB64,
      timeoutMs: 0,
      onData: async (chunk) => {
        await writer.write(chunk);
      },
    });

    await writer.close();
  } catch (error) {
    console.error('Single file download failed:', error);
    alert(`Failed to download "${name}": ${error.message}`);
  }
}

async function downloadAllAsZip() {
  downloadAllButton.style.display = 'none';
  progressContainer.style.display = 'block';
  progressBar.style.width = '0%';
  progressText.textContent = 'Starting...';

  updateStatusCard({
    card,
    iconContainer,
    status: StatusType.PRIMARY,
    icon: bundleState.isEncrypted ? Icons.DOWNLOAD_ENCRYPTED : Icons.DOWNLOAD,
  });

  // For encrypted bundles, require secure context
  if (bundleState.isEncrypted) {
    if (!window.isSecureContext || !window.streamSaver?.createWriteStream) {
      showError('Secure Context Required', 'Encrypted bundles must be downloaded in a secure context (HTTPS).');
      return;
    }
  }

  // For plain bundles in non-secure context, fall back to sequential direct downloads
  if (!bundleState.isEncrypted && (!window.isSecureContext || !window.streamSaver?.createWriteStream)) {
    progressContainer.style.display = 'none';
    statusTitle.textContent = 'Downloading Files...';
    statusMessage.textContent = 'Your browser will download each file individually.';

    for (let i = 0; i < bundleState.files.length; i++) {
      const fileId = bundleState.files[i].fileId;
      // Use iframes for sequential downloads to avoid popup blockers
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = `/api/file/${fileId}`;
      document.body.appendChild(iframe);
      // Stagger to avoid browser throttling
      await new Promise(r => setTimeout(r, 500));
    }

    // Mark bundle as downloaded
    try {
      await fetch(`/api/bundle/${bundleState.bundleId}/downloaded`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
    } catch { /* Best effort */ }

    setStatusSuccess({
      card,
      iconContainer,
      titleEl: statusTitle,
      messageEl: statusMessage,
      title: 'Downloads Started',
      message: `${bundleState.files.length} files should be downloading. Check your browser's download bar.`,
    });
    downloadActions.style.display = 'block';
    downloadAllButton.style.display = 'inline-block';
    downloadAllButton.textContent = 'Download All Again';
    return;
  }

  try {
    const zipName = `dropgate-bundle-${bundleState.bundleId.substring(0, 8)}.zip`;
    statusTitle.textContent = bundleState.isEncrypted ? 'Downloading & Decrypting' : 'Downloading';
    statusMessage.textContent = `Your browser will ask you where to save "${zipName}".`;

    const fileStream = streamSaver.createWriteStream(zipName);
    const writer = fileStream.getWriter();

    await client.downloadFiles({
      bundleId: bundleState.bundleId,
      keyB64: bundleState.keyB64,
      asZip: true,
      timeoutMs: 0,
      onProgress: (evt) => {
        progressBar.style.width = `${evt.percent}%`;
        progressText.textContent = `${formatBytes(evt.processedBytes)} / ${formatBytes(evt.totalBytes)}`;
        if (evt.currentFileName) {
          progressFileName.textContent = evt.currentFileName;
        }
      },
      onData: async (chunk) => {
        await writer.write(chunk);
      },
    });

    await writer.close();

    progressBar.style.width = '100%';
    progressFileName.textContent = '';
    setStatusSuccess({
      card,
      iconContainer,
      titleEl: statusTitle,
      messageEl: statusMessage,
      title: 'Download Complete!',
      message: bundleState.isEncrypted
        ? `All ${bundleState.files.length} files have been decrypted and saved as "${zipName}".`
        : `All ${bundleState.files.length} files have been saved as "${zipName}".`,
    });
  } catch (error) {
    console.error(error);
    progressContainer.style.display = 'none';
    progressFileName.textContent = '';
    downloadActions.style.display = 'block';
    downloadAllButton.style.display = 'inline-block';
    downloadAllButton.textContent = 'Retry Download';

    setStatusError({
      card,
      iconContainer,
      titleEl: statusTitle,
      messageEl: statusMessage,
      title: 'Download Failed',
      message: error.message || 'The bundle may have expired, or the download failed.',
    });
  }
}

async function loadMetadata() {
  const bundleId = document.body.dataset.bundleId;
  if (!bundleId) {
    showError('Invalid Link', 'The bundle ID is missing from this link.');
    return;
  }

  bundleState.bundleId = bundleId;

  try {
    const response = await fetch(`/api/bundle/${bundleId}/meta`);
    if (!response.ok) {
      showError('Bundle Not Found', 'This bundle link is invalid or has already expired.');
      return;
    }

    const meta = await response.json();
    bundleState.isEncrypted = Boolean(meta.isEncrypted);
    bundleState.totalSizeBytes = meta.totalSizeBytes;
    bundleState.files = meta.files;

    bundleFileCount.textContent = `${meta.fileCount}`;
    bundleTotalSize.textContent = formatBytes(meta.totalSizeBytes);
    bundleEncryption.textContent = meta.isEncrypted ? 'End-to-End Encrypted' : 'None';

    if (meta.isEncrypted) {
      encryptionStatement.style.display = 'block';

      if (!window.isSecureContext) {
        showError('Secure Connection Required', 'Encrypted bundles can only be downloaded over HTTPS.');
        return;
      }

      const hash = window.location.hash.substring(1);
      if (!hash) {
        showError('Missing Decryption Key', 'The decryption key was not found in the URL.');
        return;
      }

      bundleState.keyB64 = hash;

      // Decrypt filenames
      const key = await importKeyFromBase64(crypto, hash);
      for (const f of meta.files) {
        bundleState.filenames.push(await decryptFilenameFromBase64(crypto, f.encryptedFilename, key));
      }
    } else {
      for (const f of meta.files) {
        bundleState.filenames.push(f.filename || 'file');
      }
    }

    // Show details
    bundleDetails.style.display = 'block';
    fileListContainer.style.display = 'block';
    downloadActions.style.display = 'block';

    buildFileList();
    toggleFileListBtn.addEventListener('click', toggleFileList);
    downloadAllButton.addEventListener('click', downloadAllAsZip);

    statusTitle.textContent = 'Ready to Download';
    statusMessage.textContent = `${meta.fileCount} file${meta.fileCount !== 1 ? 's' : ''} available. Click "Download All as ZIP" or expand the list to download individually.`;
  } catch (error) {
    console.error(error);
    showError('Error', 'Could not load the bundle details. Please try again later.');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadMetadata);
} else {
  loadMetadata();
}
