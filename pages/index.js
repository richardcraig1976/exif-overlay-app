import { useState, useEffect, useRef } from "react";
import ExifReader from "exifr";
import JSZip from "jszip";
import { saveAs } from "file-saver";

export default function Home() {
  const [images, setImages] = useState([]);
  const [resolution, setResolution] = useState(1920);
  const [textPosition, setTextPosition] = useState("top-left");
  const [fontSize, setFontSize] = useState(20);
  const [textColor, setTextColor] = useState("#FFFFFF");
  const [showOutline, setShowOutline] = useState(true);
  const [selectedExifFields, setSelectedExifFields] = useState([
    "camera", "date", "iso", "shutter", "aperture", "focal", "gps", "description"
  ]); // Default: Show all fields

  const canvasRefs = useRef({});

  const handleImageUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (!files.length) return;

    const imagePromises = files.map(async (file) => {
      const url = URL.createObjectURL(file);

      let exifData = {};

      try {
        const exif = await ExifReader.parse(file);
        console.log(`EXIF Data for ${file.name}:`, exif); // Log all available EXIF data

        exifData = {
          camera: exif?.Model || "N/A",
          date: exif?.DateTimeOriginal || "N/A",
          iso: exif?.ISO || "N/A",
          shutter: exif?.ExposureTime ? `1/${Math.round(1 / exif.ExposureTime)}` : "N/A",
          aperture: exif?.FNumber ? `f/${exif.FNumber}` : "N/A",
          focal: exif?.FocalLength ? `${exif.FocalLength}mm` : "N/A",
          gps: exif?.latitude && exif?.longitude ? `${exif.latitude}, ${exif.longitude}` : "N/A",
          description: exif?.ImageDescription || "N/A",
        };

      } catch (error) {
        console.error(`Error reading EXIF data for ${file.name}:`, error);
      }

      return { file, url, exifData };
    });

    const imagesData = await Promise.all(imagePromises);
    setImages(imagesData);
  };


  useEffect(() => {
    images.forEach((image) => {
      if (canvasRefs.current[image.url]) {
        drawImageWithText(image, canvasRefs.current[image.url]);
      }
    });
  }, [images, resolution, textPosition, fontSize, textColor, showOutline, selectedExifFields]);

  const drawImageWithText = (image, canvas) => {
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.src = image.url;
    img.onload = () => {
      let newWidth = img.width;
      let newHeight = img.height;

      if (resolution !== "original" && newWidth > resolution) {
        newHeight = (resolution / newWidth) * newHeight;
        newWidth = resolution;
      }

      canvas.width = newWidth;
      canvas.height = newHeight;
      ctx.drawImage(img, 0, 0, newWidth, newHeight);

      ctx.font = `${fontSize}px Arial`;
      ctx.fillStyle = textColor;
      ctx.strokeStyle = "black";
      ctx.lineWidth = 3;

      const allExifData = {
        camera: `Camera: ${image.exifData.camera}`,
        date: `Date: ${image.exifData.date}`,
        iso: `ISO: ${image.exifData.iso}`,
        shutter: `Shutter: ${image.exifData.shutter}`,
        aperture: `Aperture: ${image.exifData.aperture}`,
        focal: `Focal Length: ${image.exifData.focal}`,
        gps: `GPS: ${image.exifData.gps}`,
        description: `Description: ${image.exifData.description}`,
      };

      // Only show selected fields
      const textLines = selectedExifFields.map(field => allExifData[field]);

      const padding = 20;
      let x, y;
      let maxTextWidth = Math.max(...textLines.map((line) => ctx.measureText(line).width));

      switch (textPosition) {
        case "top-left":
          x = padding;
          y = padding + fontSize;
          break;
        case "top-right":
          x = newWidth - padding - maxTextWidth;
          y = padding + fontSize;
          break;
        case "bottom-left":
          x = padding;
          y = newHeight - (textLines.length * (fontSize + 5));
          break;
        case "bottom-right":
          x = newWidth - padding - maxTextWidth;
          y = newHeight - (textLines.length * (fontSize + 5));
          break;
        case "bottom-center":
          x = (newWidth - maxTextWidth) / 2;
          y = newHeight - (textLines.length * (fontSize + 5));
          break;
        default:
          x = padding;
          y = newHeight - (textLines.length * (fontSize + 5));
      }

      textLines.forEach((line, index) => {
        if (showOutline) ctx.strokeText(line, x, y + index * (fontSize + 5));
        ctx.fillText(line, x, y + index * (fontSize + 5));
      });
    };
  };



  const downloadAllImages = async () => {
    const zip = new JSZip();
    const folder = zip.folder("exif_images");

    for (const image of images) {
      const canvas = canvasRefs.current[image.url];
      const dataUrl = canvas.toDataURL("image/jpeg");
      const blob = await fetch(dataUrl).then((res) => res.blob());
      folder.file(`${image.file.name.replace(/\.[^/.]+$/, "")}_exif.jpg`, blob);
    }

    zip.generateAsync({ type: "blob" }).then((content) => {
      saveAs(content, "exif_images.zip");
    });
  };

  return (
    <div style={{ textAlign: "center", padding: "20px" }}>
      <h1>EXIF Overlay App</h1>

      <div>
        <label>Output Resolution: </label>
        <select onChange={(e) => setResolution(e.target.value === "original" ? "original" : parseInt(e.target.value))} value={resolution}>
          <option value="1920">1920px</option>
          <option value="1080">1080px</option>
          <option value="original">Original</option>
        </select>

        <label> Text Position: </label>
        <select onChange={(e) => setTextPosition(e.target.value)} value={textPosition}>
          <option value="top-left">Top Left</option>
          <option value="top-right">Top Right</option>
          <option value="bottom-left">Bottom Left</option>
          <option value="bottom-right">Bottom Right</option>
          <option value="bottom-center">Bottom Center</option>
        </select>


        <label> Font Size: </label>
        <input type="number" value={fontSize} onChange={(e) => setFontSize(parseInt(e.target.value))} min="10" max="50" />

        <label> Text Color: </label>
        <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} />

        <label> Outline: </label>
        <input type="checkbox" checked={showOutline} onChange={() => setShowOutline(!showOutline)} />
      </div>

      <div style={{ marginTop: "10px" }}>
        <label >Select EXIF Data to Display:</label>
        <select
          multiple
          value={selectedExifFields}
          onChange={(e) => {
            const selectedOptions = Array.from(e.target.selectedOptions, (option) => option.value);
            setSelectedExifFields(selectedOptions);
          }}
          style={{ width: "200px", height: "130px", marginLeft: "10px" }}
        >
          <option value="camera">Camera Model</option>
          <option value="date">Date Taken</option>
          <option value="iso">ISO</option>
          <option value="shutter">Shutter Speed</option>
          <option value="aperture">Aperture</option>
          <option value="focal">Focal Length</option>
          <option value="gps">GPS Coordinates</option>
          <option value="description">Description</option>
        </select>
      </div>


      <input type="file" accept="image/*" multiple onChange={handleImageUpload} style={{ marginTop: "20px" }} />

      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", marginTop: "20px" }}>
        {images.map((image) => (
          <div key={image.url} style={{ margin: "10px", textAlign: "center" }}>
            {/* Display the canvas where the modified image is drawn */}
            <canvas
              ref={(el) => (canvasRefs.current[image.url] = el)}
              style={{ maxWidth: "100%", display: "block", border: "1px solid black" }}
            />

            {/* Download button for individual images */}
            <button
              onClick={() => downloadImage(image)}
              style={{
                marginTop: "10px",
                padding: "10px",
                backgroundColor: "#007bff",
                color: "white",
                border: "none",
                cursor: "pointer",
              }}
            >
              Download
            </button>
          </div>
        ))}
      </div>

      {images.length > 0 && (
        <button
          onClick={downloadAllImages}
          style={{
            marginTop: "20px",
            padding: "15px",
            backgroundColor: "#28a745",
            color: "white",
            border: "none",
            fontSize: "18px",
            cursor: "pointer",
          }}
        >
          Download All as ZIP
        </button>
      )}
    </div>
  );

}
