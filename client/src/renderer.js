document.addEventListener('DOMContentLoaded', async () => {
    try {
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });

        // --- DOM Element References ---
        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('file-input');
        const selectFileBtn = document.getElementById('select-file-btn');
        const fileNameDisplay = document.getElementById('file-name');
        const serverUrlInput = document.getElementById('server-url');
        const testConnectionBtn = document.getElementById('test-connection-btn');
        const connectionStatus = document.getElementById('connection-status');
        const fileLifetimeValueInput = document.getElementById('file-lifetime-value');
        const fileLifetimeUnitSelect = document.getElementById('file-lifetime-unit');
        const encryptCheckbox = document.getElementById('encrypt-checkbox');
        const uploadBtn = document.getElementById('upload-btn');
        const uploadStatus = document.getElementById('upload-status');
        const progressBar = document.getElementById('progress-bar');
        const linkSection = document.getElementById('link-section');
        const downloadLinkInput = document.getElementById('download-link');
        const copyBtn = document.getElementById('copy-btn');

        let serverCapabilities = null;
        let selectedFile = null;
        const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB

        function isFile(file) {
            return new Promise((resolve) => {
                // A simple check for the presence of a file type can often identify files.
                // Directories will have an empty string as their type.
                if (file.type !== '') {
                    return resolve(true);
                }

                // For files without a type, we can use FileReader.
                // Reading a directory will result in an error.
                const reader = new FileReader();
                reader.onloadend = () => {
                    if (reader.error) {
                        resolve(false);
                    } else {
                        resolve(true);
                    }
                };
                reader.readAsArrayBuffer(file);
            });
        }

        // --- Initial Settings Load ---
        const settings = await window.electronAPI.getSettings();
        serverUrlInput.value = settings.serverURL || '';
        await checkServerCompatibility();
        fileLifetimeValueInput.value = settings.lifetimeValue || 24;
        fileLifetimeUnitSelect.value = settings.lifetimeUnit || 'hours';
        if (fileLifetimeUnitSelect.value === 'unlimited') {
            fileLifetimeValueInput.disabled = true;
        }

        // --- Event Listeners ---
        fileLifetimeValueInput.addEventListener('blur', () => {
            if (fileLifetimeUnitSelect.value !== 'unlimited') {
                const value = parseFloat(fileLifetimeValueInput.value);
                if (isNaN(value) || value <= 0) {
                    fileLifetimeValueInput.value = 0.5;
                }
            }
            validateLifetimeInput();
            saveSettings();
        });

        fileLifetimeUnitSelect.addEventListener('change', () => {
            if (fileLifetimeUnitSelect.value === 'unlimited') {
                fileLifetimeValueInput.disabled = true;
                fileLifetimeValueInput.value = 0;
            } else {
                fileLifetimeValueInput.disabled = false;
                const value = parseFloat(fileLifetimeValueInput.value);
                if (isNaN(value) || value <= 0) {
                    fileLifetimeValueInput.value = 0.5;
                }
            }
            validateLifetimeInput();
            saveSettings();
        });

        selectFileBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('drag-over');
        });
        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('drag-over');
        });
        dropZone.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('drag-over');

            const files = e.dataTransfer.files;
            if (!files || files.length === 0) return;

            const droppedFile = files[0];

            // Check if the dropped item is a file
            const isValidFile = await isFile(droppedFile);

            if (isValidFile) {
                handleFile(droppedFile);
            } else {
                uploadStatus.textContent = 'Folders cannot be uploaded.';
                uploadStatus.className = 'form-text mt-1 text-warning';
                selectedFile = null;
                fileNameDisplay.textContent = '';
                fileInput.value = '';
                uploadBtn.disabled = true;
            }
        });

        testConnectionBtn.addEventListener('click', async () => {
            const serverUrl = serverUrlInput.value.trim();
            if (!serverUrl) {
                connectionStatus.textContent = 'Please enter a server URL.';
                connectionStatus.className = 'form-text mt-1 text-warning';
                return;
            }
            uploadStatus.textContent = '';
            testConnectionBtn.disabled = true;
            testConnectionBtn.textContent = 'Testing...';
            connectionStatus.textContent = 'Pinging server...';
            connectionStatus.className = 'form-text mt-1 text-muted';
            const cleanUrl = await cleanServerUrl(serverUrl);
            try {
                const response = await fetch(cleanUrl, { method: 'GET', signal: AbortSignal.timeout(5000) });
                if (response.ok) {
                    if (cleanUrl.startsWith('https://')) {
                        connectionStatus.textContent = 'Connection successful (HTTPS).';
                        connectionStatus.className = 'form-text mt-1 text-success';
                    } else {
                        connectionStatus.textContent = 'Connection successful (HTTP) — connection is insecure.';
                        connectionStatus.className = 'form-text mt-1 text-warning';
                    }
                } else {
                    connectionStatus.textContent = `Failed. Server responded with status: ${response.status}`;
                    connectionStatus.className = 'form-text mt-1 text-danger';
                }
                await checkServerCompatibility();
            } catch (error) {
                connectionStatus.textContent = 'Connection failed. Check URL or if server is running.';
                connectionStatus.className = 'form-text mt-1 text-danger';
            } finally {
                testConnectionBtn.disabled = false;
                testConnectionBtn.textContent = 'Test';
            }
        });

        copyBtn.addEventListener('click', () => {
            downloadLinkInput.select();
            document.execCommand('copy');
        });

        // --- IPC Listeners (Communication from Main Process) ---

        // Listens for UI update commands from main.js
        window.electronAPI.onUpdateUI((event) => {
            switch (event.type) {
                case 'progress':
                    const { text, percent } = event.data;
                    if (text) {
                        uploadStatus.textContent = text;
                        uploadStatus.className = 'form-text mt-1 text-muted';
                    }
                    if (percent !== undefined) {
                        progressBar.style.width = percent.toFixed(2) + '%';
                        progressBar.setAttribute('aria-valuenow', percent.toFixed(2));
                        progressBar.textContent = percent.toFixed(0) + '%';
                    }
                    uploadBtn.disabled = true;
                    uploadBtn.textContent = 'Uploading...';
                    linkSection.style.display = 'none';
                    break;
                case 'success':
                    const { link } = event.data;
                    downloadLinkInput.value = link;
                    linkSection.style.display = 'block';
                    uploadStatus.textContent = 'Upload successful!';
                    uploadStatus.className = 'form-text mt-1 text-success';
                    resetUI();
                    break;
                case 'error':
                    const { error } = event.data;
                    uploadStatus.textContent = `Upload failed: ${error}`;
                    uploadStatus.className = 'form-text mt-1 text-danger';
                    resetUI(false);
                    break;
            }
        });

        // Listens for a file opened via the 'Open File' menu
        window.electronAPI.onFileOpened((file) => {
            if (file && file.data) {
                const newFile = new File([file.data], file.name, { type: '' });
                handleFile(newFile);
            }
        });

        // Listens for a background upload triggered from the context menu
        window.electronAPI.onBackgroundUploadStart(async (details) => {
            console.log('Background upload triggered with details:', details);

            if (details && details.data) {
                console.log('File size:', details.data.byteLength, 'bytes');
                const file = new File([details.data], details.name);
                selectedFile = file;
                encryptCheckbox.checked = details.useE2EE || false;

                const settings = await window.electronAPI.getSettings();
                console.log('Settings loaded:', settings);

                if (!settings.serverURL) {
                    console.error('No server URL configured!');
                    window.electronAPI.uploadFinished({
                        status: 'error',
                        error: 'Server URL is not configured.'
                    });
                    return;
                }
                serverUrlInput.value = settings.serverURL;

                console.log('Starting upload...');
                // Trigger the centralised upload function
                await performUpload();
            } else {
                console.error('Invalid details received:', details);
            }
        });

        function handleFile(file) {
            // Clear any previous error messages
            uploadStatus.textContent = '';

            if (!file) {
                selectedFile = null;
                fileNameDisplay.textContent = '';
                fileInput.value = '';
                uploadBtn.disabled = true;
                return;
            }

            if (file.size === 0) {
                uploadStatus.textContent = 'Error: Cannot upload empty (0 byte) files.';
                uploadStatus.className = 'form-text mt-1 text-danger';
                selectedFile = null;
                fileNameDisplay.textContent = '';
                fileInput.value = '';
                uploadBtn.disabled = true;
                return;
            }

            selectedFile = file;
            fileNameDisplay.textContent = file.name;
            uploadBtn.disabled = false;
            linkSection.style.display = 'none';
        }

        // Trigger for uploads started from the UI
        uploadBtn.addEventListener('click', performUpload);

        /**
         * The main upload logic.
         * It reports progress and final status back to the main process via IPC.
         */
        async function performUpload() {
            const serverCheck = await checkServerCompatibility();
            if (!serverCheck.compatible) {
                window.electronAPI.uploadFinished({ status: 'error', error: serverCheck.message || 'Server is not compatible.' });
                return;
            }

            if (fileLifetimeUnitSelect.value !== 'unlimited') {
                const value = parseFloat(fileLifetimeValueInput.value);
                if (isNaN(value) || value <= 0) fileLifetimeValueInput.value = 0.5;
            }

            if (!selectedFile) {
                window.electronAPI.uploadFinished({ status: 'error', error: 'File is missing.' });
                return;
            }

            const useEncryption = encryptCheckbox.checked;

            // Use cached capabilities
            if (serverCapabilities && serverCapabilities.upload) {
                const maxMB = serverCapabilities.upload.maxSizeMB;
                if (maxMB > 0 && selectedFile.size > (maxMB * 1024 * 1024)) {
                    window.electronAPI.uploadFinished({
                        status: 'error',
                        error: `File too large. Server limit: ${maxMB} MB.`
                    });
                    return;
                }

                // Double check lifetime before starting
                if (!validateLifetimeInput()) {
                    return;
                }

                // Double check E2EE support
                if (useEncryption && (!serverCapabilities.upload.e2ee)) {
                    window.electronAPI.uploadFinished({
                        status: 'error',
                        error: 'Server does not support end-to-end encryption.'
                    });
                    return;
                }
            }

            const cleanUrl = await cleanServerUrl(serverUrlInput.value);

            let keyB64 = null;
            let cryptoKey = null;
            let encryptedFilename = selectedFile.name;

            // 1. Calculate Size with Overhead
            const totalChunks = Math.ceil(selectedFile.size / CHUNK_SIZE);
            let totalUploadSize = selectedFile.size;

            if (useEncryption) {
                // AES-GCM adds 16 bytes tag + 12 bytes IV = 28 bytes per chunk
                const overhead = totalChunks * 28;
                totalUploadSize += overhead;

                window.electronAPI.uploadProgress({ text: 'Generating encryption key...' });
                try {
                    cryptoKey = await generateKey();
                    keyB64 = await exportKey(cryptoKey);
                    const filenameBuffer = new TextEncoder().encode(selectedFile.name);
                    const encryptedFilenameBlob = await encryptData(filenameBuffer, cryptoKey);
                    const reader = new FileReader();
                    encryptedFilename = await new Promise((resolve) => {
                        reader.onload = () => resolve(reader.result.split(',')[1]);
                        reader.readAsDataURL(encryptedFilenameBlob);
                    });
                } catch (err) {
                    window.electronAPI.uploadFinished({ status: 'error', error: 'Failed to prepare encryption.' });
                    return;
                }
            }

            try {
                window.electronAPI.uploadProgress({ text: 'Reserving server storage...' });

                // 2. Init with Total Size and Chunks
                const initResponse = await fetch(`${cleanUrl}/upload/init`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        filename: encryptedFilename,
                        lifetime: getLifetimeInMs(),
                        isEncrypted: useEncryption,
                        totalSize: totalUploadSize,
                        totalChunks: totalChunks
                    }),
                });

                if (!initResponse.ok) {
                    const errorData = await initResponse.json().catch(() => ({}));
                    throw new Error(errorData.error || `Server initialisation failed: ${initResponse.status}`);
                }

                const { uploadId } = await initResponse.json();

                // 3. Upload Loop
                for (let i = 0; i < totalChunks; i++) {
                    const start = i * CHUNK_SIZE;
                    const end = Math.min(start + CHUNK_SIZE, selectedFile.size);
                    let chunkBlob = selectedFile.slice(start, end);

                    const percentComplete = ((i) / totalChunks) * 100;
                    window.electronAPI.uploadProgress({
                        text: `Uploading chunk ${i + 1} of ${totalChunks}...`,
                        percent: percentComplete
                    });

                    // Encrypt
                    if (useEncryption) {
                        const chunkBuffer = await chunkBlob.arrayBuffer();
                        chunkBlob = await encryptData(chunkBuffer, cryptoKey);
                    }

                    // Hash the final chunk (encrypted or plain)
                    const bufferToHash = await chunkBlob.arrayBuffer();
                    const hashBuffer = await crypto.subtle.digest('SHA-256', bufferToHash);
                    const hashArray = Array.from(new Uint8Array(hashBuffer));
                    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

                    // Send with Index and Hash
                    const headers = {
                        'Content-Type': 'application/octet-stream',
                        'X-Upload-ID': uploadId,
                        'X-Chunk-Index': i.toString(),
                        'X-Chunk-Hash': hashHex
                    };

                    const chunkResponse = await attemptChunkUpload(`${cleanUrl}/upload/chunk`, {
                        method: 'POST',
                        headers: headers,
                        body: chunkBlob,
                    });

                    if (!chunkResponse.ok) throw new Error(`Chunk ${i + 1} failed.`);
                }

                window.electronAPI.uploadProgress({ text: 'Finalising upload...', percent: 100 });
                const completeResponse = await fetch(`${cleanUrl}/upload/complete`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ uploadId }),
                    signal: AbortSignal.timeout(30000)
                });

                if (!completeResponse.ok) {
                    const errorData = await completeResponse.json().catch(() => ({}));
                    throw new Error(errorData.error || 'Finalisation failed.');
                }

                const response = await completeResponse.json();
                let downloadLink = `${cleanUrl}/${response.id}`;
                if (useEncryption) downloadLink += `#${keyB64}`;

                window.electronAPI.uploadFinished({ status: 'success', link: downloadLink });
            } catch (error) {
                window.electronAPI.uploadFinished({ status: 'error', error: error.message });
            }
        }

        async function attemptChunkUpload(url, options, retries = 5, backoff = 1000, maxRetries = 5) {
            try {
                const response = await fetch(url, options);
                if (!response.ok) {
                    // Throw to trigger the catch block for retry logic
                    throw new Error(`Error: ${response.status}`);
                }
                return response;
            } catch (err) {
                // If the error is an AbortError (user cancelled), do not retry.
                if (err.name === 'AbortError') throw err;

                if (retries > 0) {
                    console.warn(`Chunk upload failed. Retrying... Error: ${err.message}`);
                    let remainingTime = backoff;
                    const updateInterval = 100;
                    const currentAttempt = maxRetries - retries + 1;

                    while (remainingTime > 0) {
                        const secondsLeft = (remainingTime / 1000).toFixed(1);

                        window.electronAPI.uploadProgress({
                            text: `Chunk upload failed. Retrying in ${secondsLeft}s... (${currentAttempt}/${maxRetries})`
                        });

                        await new Promise(resolve => setTimeout(resolve, updateInterval));
                        remainingTime -= updateInterval;
                    }

                    window.electronAPI.uploadProgress({
                        text: `Chunk upload failed. Retrying now... (${currentAttempt}/${maxRetries})`
                    });
                    return attemptChunkUpload(url, options, retries - 1, backoff * 2, maxRetries);
                }
                throw err;
            }
        }

        // --- Utility Functions ---

        function saveSettings() {
            window.electronAPI.setSettings({
                serverURL: serverUrlInput.value,
                lifetimeValue: fileLifetimeValueInput.value,
                lifetimeUnit: fileLifetimeUnitSelect.value
            });
        }

        function getLifetimeInMs() {
            const unit = fileLifetimeUnitSelect.value;
            const value = parseFloat(fileLifetimeValueInput.value, 10) || 0;
            if (unit === 'unlimited' || value <= 0) return 0;
            const multipliers = {
                minutes: 60 * 1000,
                hours: 60 * 60 * 1000,
                days: 24 * 60 * 60 * 1000,
            };
            return value * (multipliers[unit] || 0);
        }

        async function cleanServerUrl(url) {
            if (!url) return;
            let cleanUrl = url.trim().replace(/\/+$/, '');
            if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
                cleanUrl = 'https://' + cleanUrl;
            }

            try {
                const response = await fetch(cleanUrl, { method: 'HEAD', signal: AbortSignal.timeout(3000) });
                if (response.ok) return cleanUrl;
            } catch (error) {
                console.warn('HTTPS check failed, falling back to HTTP');
                return cleanUrl.replace(/^https:\/\//, 'http://');
            }
            return cleanUrl;
        }

        async function checkServerCompatibility() {
            uploadStatus.textContent = '';
            const serverUrl = await cleanServerUrl(serverUrlInput.value.trim());
            if (!serverUrl) return { compatible: false, message: 'No server URL provided.' };

            try {
                const clientVersion = await window.electronAPI.getClientVersion();
                const response = await fetch(serverUrl, { signal: AbortSignal.timeout(5000) });
                const serverInfo = await response.json();

                if (!serverInfo || !serverInfo?.version || !serverInfo?.capabilities) {
                    const message = 'Error: Cannot determine server version or capabilities.';
                    uploadStatus.textContent = message;
                    uploadStatus.className = 'form-text mt-1 text-danger';
                    return { compatible: false, message };
                }

                serverCapabilities = serverInfo.capabilities;
                applyServerLimits();
                const serverVersion = serverInfo.version;

                const [clientMajor, clientMinor] = clientVersion.split('.').map(Number);
                const [serverMajor, serverMinor] = serverVersion.split('.').map(Number);

                if (clientMajor !== serverMajor) {
                    uploadBtn.disabled = true;
                    const message = `Error: Incompatible versions. Client v${clientVersion}, Server v${serverVersion}.${serverInfo.name ? ` (${serverInfo.name})` : ''}`;
                    uploadStatus.textContent = message;
                    uploadStatus.className = 'form-text mt-1 text-danger';
                    return { compatible: false, message };
                } else if (clientMinor > serverMinor) {
                    const message = `Warning: Client (v${clientVersion}) is newer than Server (v${serverVersion}).${serverInfo.name ? ` (${serverInfo.name})` : ''}`;
                    uploadStatus.textContent = message;
                    uploadStatus.className = 'form-text mt-1 text-warning';
                    return { compatible: true, message };
                } else {
                    const message = `Server: v${serverVersion}, Client: v${clientVersion}.${serverInfo.name ? ` (${serverInfo.name})` : ''}`;
                    uploadStatus.textContent = message;
                    uploadStatus.className = 'form-text mt-1 text-info';
                    return { compatible: true, message };
                }
            } catch (error) {
                const message = 'Could not connect to the server.';
                uploadStatus.textContent = message;
                uploadStatus.className = 'form-text mt-1 text-danger';
                console.error('Compatibility check failed:', error);
                return { compatible: false, message };
            }
        }

        function validateLifetimeInput() {
            if (!serverCapabilities || !serverCapabilities.upload) return false; // Because we can't validate

            const limitHours = serverCapabilities.upload.maxLifetimeHours;

            // If server allows unlimited, and user selected unlimited, we are good.
            if (limitHours === 0 && fileLifetimeUnitSelect.value === 'unlimited') return true;

            // If user selected unlimited but server forbids it (should be caught by UI, but double check)
            if (limitHours > 0 && fileLifetimeUnitSelect.value === 'unlimited') {
                fileLifetimeUnitSelect.value = 'hours';
                fileLifetimeValueInput.disabled = false;
            }

            const currentMs = getLifetimeInMs();
            const limitMs = limitHours * 60 * 60 * 1000;

            if (limitHours > 0 && currentMs > limitMs) {
                function hoursToReadable(hours) {
                    if (hours < 1) {
                        const minutes = Math.round(hours * 60);
                        return `${minutes} minute(s)`;
                    } else if (hours < 24) {
                        return `${hours} hour(s)`;
                    } else {
                        const days = (hours / 24).toFixed(2) % 1 === 0 ? (hours / 24).toFixed(0) : (hours / 24).toFixed(2);
                        return `${days} day(s)`;
                    }
                }
                uploadStatus.textContent = `File lifetime too long. Server limit: ${hoursToReadable(limitHours)}.`;
                uploadStatus.className = 'form-text mt-1 text-danger';
                uploadBtn.disabled = true;
                return false;
            } else {
                // Only clear status if it was a time limit error
                if (uploadStatus.textContent.includes('File lifetime too long')) {
                    uploadStatus.textContent = '';
                }
                if (selectedFile) uploadBtn.disabled = false;
                return true;
            }
        }

        // Apply server-enforced limits to the UI
        function applyServerLimits() {
            if (!serverCapabilities || !serverCapabilities.upload) return;

            const limitHours = serverCapabilities.upload.maxLifetimeHours;
            const unlimitedOption = fileLifetimeUnitSelect.querySelector('option[value="unlimited"]');

            if (limitHours > 0) {
                // Server has a limit: Disable "Unlimited"
                if (unlimitedOption) {
                    unlimitedOption.disabled = true;
                    unlimitedOption.textContent = 'Unlimited (Disabled by Server)';
                }

                // If currently selected is unlimited, switch to hours
                if (fileLifetimeUnitSelect.value === 'unlimited') {
                    fileLifetimeUnitSelect.value = 'hours';
                    fileLifetimeValueInput.disabled = false;
                    fileLifetimeValueInput.value = Math.min(24, limitHours);
                }
            } else {
                // Server allows unlimited
                if (unlimitedOption) {
                    unlimitedOption.disabled = false;
                    unlimitedOption.textContent = 'Unlimited';
                }
            }

            // Re-validate current inputs
            validateLifetimeInput();
        }

        // Helper to reset the UI state after an upload completes or fails
        function resetUI(clearFile = true) {
            uploadBtn.textContent = 'Upload';
            if (clearFile) {
                selectedFile = null;
                fileNameDisplay.textContent = '';
                fileInput.value = '';
                uploadBtn.disabled = true;
            } else {
                uploadBtn.disabled = false;
            }

            setTimeout(() => {
                progressBar.style.width = '0%';
                progressBar.setAttribute('aria-valuenow', 0);
                progressBar.textContent = '';
            }, 3000);
        }

        // --- Crypto Functions ---
        async function generateKey() {
            return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
        }

        async function exportKey(key) {
            const exported = await crypto.subtle.exportKey('raw', key);
            return btoa(String.fromCharCode.apply(null, new Uint8Array(exported)));
        }

        async function encryptData(dataBuffer, key) {
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const encryptedContent = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, dataBuffer);
            const finalBlob = new Blob([iv, new Uint8Array(encryptedContent)]);
            return finalBlob;
        }

        window.electronAPI.rendererReady();
    } catch (error) {
        console.error('FATAL ERROR in renderer initialisation:', error);
        alert('Fatal error initialising renderer: ' + error.message);
    }
});