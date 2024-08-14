async function fetchObservationData(observationId) {
    const response = await fetch(`https://api.inaturalist.org/v1/observations/${observationId}`);
    return (await response.json()).results[0];
}

async function fetchTaxonTranslation(taxonId, locale = 'ru') {
    const response = await fetch(`https://api.inaturalist.org/v1/taxa/${taxonId}?locale=${locale}`);
    return (await response.json()).results[0].preferred_common_name;
}

function setupCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    const scale = window.devicePixelRatio || 1;
    canvas.width *= scale;
    canvas.height *= scale;
    ctx.scale(scale, scale);
    return ctx;
}

function extractRegion(locationString) {
    if (!locationString) return 'N/A';
    const parts = locationString.split(',').map(part => part.trim());
    return parts.length <= 2 ? locationString : `${parts[parts.length - 2]}, ${parts[parts.length - 1]}`;
}

function getDominantColor(image, ctx) {
    const data = ctx.getImageData(0, 0, image.width, image.height).data;
    let r = 0, g = 0, b = 0, count = 0;

    for (let i = 0; i < data.length; i += 20) { // Increased step for better performance
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        count++;
    }

    return { r: r / count, g: g / count, b: b / count };
}

function adjustColorForBackground({ r, g, b }) {
    const desaturation = 0.2, lightness = 0.1;
    r += (255 - r) * (desaturation + lightness);
    g += (255 - g) * (desaturation + lightness);
    b += (255 - b) * (desaturation + lightness);
    return `rgb(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)})`;
}

function setCanvasBackground(image, ctx) {
    ctx.drawImage(image, 0, 0, image.width, image.height);
    const dominantColor = getDominantColor(image, ctx);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = adjustColorForBackground(dominantColor);
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

function drawObservationOnCanvas(data, translatedName) {
    const canvas = document.getElementById('observation-canvas');
    const ctx = setupCanvas(canvas);

    const canvasWidth = 1080, canvasHeight = 1920;
    const imageMaxWidth = 920, imageRadius = 64;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const image = new Image();
    image.crossOrigin = "anonymous"; 
    image.src = data.photos[0].url.replace('square', 'medium');

    image.onload = () => {
        setCanvasBackground(image, ctx);

        const imageRatio = image.width / image.height;
        const imageWidth = Math.min(imageMaxWidth, canvasWidth);
        const imageHeight = imageWidth / imageRatio;
        const imageX = (canvasWidth - imageWidth) / 2;
        const imageY = (canvasHeight - imageHeight) / 2;

        // Clipping the image with rounded corners
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(imageX + imageRadius, imageY);
        ctx.lineTo(imageX + imageWidth - imageRadius, imageY);
        ctx.quadraticCurveTo(imageX + imageWidth, imageY, imageX + imageWidth, imageY + imageRadius);
        ctx.lineTo(imageX + imageWidth, imageY + imageHeight - imageRadius);
        ctx.quadraticCurveTo(imageX + imageWidth, imageY + imageHeight, imageX + imageWidth - imageRadius, imageY + imageHeight);
        ctx.lineTo(imageX + imageRadius, imageY + imageHeight);
        ctx.quadraticCurveTo(imageX, imageY + imageHeight, imageX, imageY + imageHeight - imageRadius);
        ctx.lineTo(imageX, imageY + imageRadius);
        ctx.quadraticCurveTo(imageX, imageY, imageX + imageRadius, imageY);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(image, imageX, imageY, imageWidth, imageHeight);

        // Top gradient
        const gradientTop = ctx.createLinearGradient(0, imageY, 0, imageY + 280);
        gradientTop.addColorStop(0, 'rgba(0, 0, 0, 0.70)');
        gradientTop.addColorStop(1, 'rgba(0, 0, 0, 0.00)');
        ctx.fillStyle = gradientTop;
        ctx.fillRect(imageX, imageY, imageWidth, 280);

        // Bottom gradient
        const gradientBottom = ctx.createLinearGradient(0, imageY + imageHeight - 200, 0, imageY + imageHeight);
        gradientBottom.addColorStop(0, 'rgba(0, 0, 0, 0.00)');
        gradientBottom.addColorStop(1, 'rgba(0, 0, 0, 0.70)');
        ctx.fillStyle = gradientBottom;
        ctx.fillRect(imageX, imageY + imageHeight - 200, imageWidth, 200);

        ctx.restore();

        // Text styling
        ctx.fillStyle = "#FFF";
        ctx.font = "800 72px Lato";
        ctx.textBaseline = "top";
        ctx.fillText(`${data.taxon.preferred_common_name || 'N/A'}`, imageX + 40, imageY + 32);
        ctx.font = "400 42px Lato";
        ctx.fillText(`${translatedName || 'N/A'}`, imageX + 40, imageY + 32 + 72 + 16);

        // Loading location icon and displaying date/time
        const icon = new Image();
        icon.src = 'assets/pin.svg';
        const logo = new Image();
        logo.src = 'assets/inaturalist-logo.svg';
        logo.onload = () => {
            const iconX = imageX + 40, iconY = imageY + imageHeight - 132;
            ctx.drawImage(icon, iconX, iconY, 24, 32);
            
            const logoX = imageX + imageWidth - 275.758 - 40, logoY = imageY + imageHeight - 50 - 40;
            ctx.drawImage(logo, logoX, logoY, 275.758, 50);

            const region = extractRegion(data.place_guess || data.location);
            ctx.fillText(region, iconX + 24 + 16, iconY - 10);

            const observedDate = new Date(data.time_observed_at || data.observed_on);
            const formattedDateTime = `${observedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}, ${observedDate.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
            ctx.fillText(formattedDateTime, iconX, iconY + 48);

            // After drawing everything, convert the canvas to an image and display it
            const finalImage = document.createElement('img');
            finalImage.src = canvas.toDataURL('image/png');
            finalImage.alt = "Generated Observation Image";

            // Clear the previous content and show the generated image
            const container = document.getElementById('image-container');
            container.innerHTML = ''; // Clear previous content
            container.appendChild(finalImage); // Display the new image
        };
    };
}

// Event listener for the fetch button
document.getElementById('fetch-btn').addEventListener('click', async () => {
    const observationUrl = document.getElementById('observation-url').value;
    const observationId = observationUrl.split('/').pop();
    const data = await fetchObservationData(observationId);
    const translatedName = await fetchTaxonTranslation(data.taxon.id, 'ru');
    drawObservationOnCanvas(data, translatedName);
});
