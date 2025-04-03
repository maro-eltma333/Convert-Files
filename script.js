document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('conversionForm');
    const fileTypeSelect = document.getElementById('fileType');
    const targetFormatSelect = document.getElementById('targetFormat');
    const progressDiv = document.getElementById('progress');
    const progressBar = document.querySelector('.progress-bar');
    const fileNameDisplay = document.getElementById('file-name');
    const removeFileBtn = document.getElementById('remove-file');
    const fileInput = document.getElementById('file');

    const formatOptions = {
        image: ['png', 'jpg', 'jpeg', 'webp', 'gif'],
        audio: ['mp3', 'wav', 'ogg', 'm4a']
    };

    fileTypeSelect.addEventListener('change', function() {
        const selectedType = this.value;
        targetFormatSelect.innerHTML = '<option value="">Select target format...</option>';
        
        if (selectedType) {
            formatOptions[selectedType].forEach(format => {
                const option = document.createElement('option');
                option.value = format;
                option.textContent = format.toUpperCase();
                targetFormatSelect.appendChild(option);
            });
        }
    });

    fileInput.addEventListener('change', function(e) {
        if (this.files.length > 0) {
            fileNameDisplay.textContent = this.files[0].name;
            removeFileBtn.classList.remove('d-none');
        } else {
            resetFileInput();
        }
    });

    removeFileBtn.addEventListener('click', function() {
        resetFileInput();
    });

    function resetFileInput() {
        fileInput.value = '';
        fileNameDisplay.textContent = 'Click to upload or drag and drop';
        removeFileBtn.classList.add('d-none');
    }

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const file = fileInput.files[0];
        const fileType = fileTypeSelect.value;
        const targetFormat = targetFormatSelect.value;

        if (!file || !fileType || !targetFormat) {
            Swal.fire({
                icon: 'error',
                title: 'Oops...',
                text: 'Please fill in all fields!',
                confirmButtonColor: '#4a6bff'
            });
            return;
        }

        Swal.fire({
            title: 'Converting File',
            html: 'Please wait while we process your file...',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        try {
            if (fileType === 'image') {
                await convertImage(file, targetFormat);
            } else if (fileType === 'audio') {
                await convertAudio(file, targetFormat);
            }

            Swal.fire({
                icon: 'success',
                title: 'Success!',
                text: 'Your file has been converted successfully!',
                confirmButtonColor: '#4a6bff'
            });

        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error!',
                text: error.message || 'Something went wrong!',
                confirmButtonColor: '#4a6bff'
            });
        }
    });

    async function convertImage(file, targetFormat) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = new Image();
                img.onload = function() {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);

                    canvas.toBlob(blob => {
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `converted.${targetFormat}`;
                        document.body.appendChild(a);
                        a.click();
                        URL.revokeObjectURL(url);
                        document.body.removeChild(a);
                        resolve();
                    }, `image/${targetFormat}`);
                };
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error('Failed to read image file'));
            reader.readAsDataURL(file);
        });
    }

    async function convertAudio(file, targetFormat) {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        const offlineContext = new OfflineAudioContext(
            audioBuffer.numberOfChannels,
            audioBuffer.length,
            audioBuffer.sampleRate
        );

        const source = offlineContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(offlineContext.destination);
        source.start();

        const renderedBuffer = await offlineContext.startRendering();
        const wavBlob = await bufferToWav(renderedBuffer);
        
        const url = URL.createObjectURL(wavBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `converted.${targetFormat}`;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }

    function bufferToWav(buffer) {
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const format = 1;
        const bitDepth = 16;
        
        const bytesPerSample = bitDepth / 8;
        const blockAlign = numChannels * bytesPerSample;
        
        const wav = new ArrayBuffer(44 + buffer.length * blockAlign);
        const view = new DataView(wav);
        
        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + buffer.length * blockAlign, true);
        writeString(view, 8, 'WAVE');
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, format, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * blockAlign, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitDepth, true);
        writeString(view, 36, 'data');
        view.setUint32(40, buffer.length * blockAlign, true);
        
        const offset = 44;
        const channelData = [];
        for (let i = 0; i < numChannels; i++) {
            channelData.push(buffer.getChannelData(i));
        }
        
        for (let i = 0; i < buffer.length; i++) {
            for (let channel = 0; channel < numChannels; channel++) {
                const sample = channelData[channel][i];
                const int16Sample = Math.max(-1, Math.min(1, sample)) * 0x7FFF;
                view.setInt16(offset + (i * blockAlign) + (channel * bytesPerSample), int16Sample, true);
            }
        }
        
        return new Blob([wav], { type: 'audio/wav' });
    }

    function writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    const dropZone = document.querySelector('.file-input-label');
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight, false);
    });

    function highlight(e) {
        dropZone.classList.add('border-primary');
    }

    function unhighlight(e) {
        dropZone.classList.remove('border-primary');
    }

    dropZone.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        fileInput.files = files;
        fileNameDisplay.textContent = files[0].name;
        removeFileBtn.classList.remove('d-none');
    }
}); 