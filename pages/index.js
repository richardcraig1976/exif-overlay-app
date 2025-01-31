import { useState, useEffect, useRef } from "react";
import { AppShell, Navbar, Select, MultiSelect, Button, ColorInput, Checkbox, NumberInput, FileInput, ScrollArea, Switch, Group, useMantineColorScheme, Text } from "@mantine/core";
import { IconSun, IconMoon } from "@tabler/icons-react";
import ExifReader from "exifr";
import JSZip from "jszip";
import { saveAs } from "file-saver";

export default function Home() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const dark = colorScheme === "dark";

  const [images, setImages] = useState([]);
  const [selectedFont, setSelectedFont] = useState("Arial");
  const [resolution, setResolution] = useState("1920");
  const [textPosition, setTextPosition] = useState("top-left");
  const [fontSize, setFontSize] = useState(20);
  const [textColor, setTextColor] = useState("#FFFFFF");
  const [showOutline, setShowOutline] = useState(true);
  const [selectedExifFields, setSelectedExifFields] = useState(["camera", "date", "iso", "shutter", "aperture", "focal", "gps", "description"]);
  const [imageQuality, setImageQuality] = useState(100);
  const canvasRefs = useRef({});

  // Handle theme toggle
  const toggleDarkMode = () => {
    const newTheme = dark ? "light" : "dark";
    setColorScheme(newTheme);
    localStorage.setItem("theme", newTheme); // Persist theme preference
  };

  useEffect(() => {
    const storedTheme = localStorage.getItem("theme");
    if (storedTheme) {
      setColorScheme(storedTheme);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("exifSettings", JSON.stringify({
      fontSize, textColor, showOutline, selectedExifFields
    }));
  }, [selectedFont, fontSize, textColor, showOutline, selectedExifFields]);

  useEffect(() => {
    const savedSettings = JSON.parse(localStorage.getItem("exifSettings"));
    if (savedSettings) {
      setSelectedFont(savedSettings.selectedFont);
      setFontSize(savedSettings.fontSize);
      setTextColor(savedSettings.textColor);
      setShowOutline(savedSettings.showOutline);
      setSelectedExifFields(savedSettings.selectedExifFields);
    }
  }, []);

  const handleImageUpload = async (files) => {
    const imagePromises = Array.from(files).map(async (file) => {
      const url = URL.createObjectURL(file);
      let exifData = {};
      try {
        const exif = await ExifReader.parse(file);
        console.log(`EXIF Data for ${file.name}:`, exif);

        exifData = {
          camera: exif?.Model || "N/A",
          date: exif?.DateTimeOriginal || "N/A",
          iso: exif?.ISO || "N/A",
          shutter: exif?.ExposureTime ? `1/${Math.round(1 / exif.ExposureTime)}` : "N/A",
          aperture: `f/${exif?.FNumber ?? "N/A"}`,
          focal: `${exif?.FocalLength ?? "N/A"}mm`,
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
  }, [images, selectedFont, resolution, textPosition, fontSize, textColor, showOutline, selectedExifFields]);

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

      ctx.font = `${fontSize}px '${selectedFont}', sans-serif`;
      ctx.fillStyle = textColor;
      ctx.strokeStyle = dark ? "#FFFFFF" : "#000000"; // Contrast in dark mode
      ctx.lineWidth = 2;

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

      const textLines = selectedExifFields.map(field => allExifData[field]);
      const padding = 20;
      let x, y;
      let maxTextWidth = Math.max(...textLines.map((line) => ctx.measureText(line).width));

      switch (textPosition) {
        case "bottom-center":
          x = (newWidth - maxTextWidth) / 2;
          y = newHeight - (textLines.length * (fontSize + 5));
          break;
        case "top-right":
        case "bottom-right":
          x = newWidth - padding - maxTextWidth;
          y = textPosition === "top-right" ? padding + fontSize : newHeight - (textLines.length * (fontSize + 5));
          break;
        default:
          x = padding;
          y = textPosition === "top-left" ? padding + fontSize : newHeight - (textLines.length * (fontSize + 5));
      }

      textLines.forEach((line, index) => {
        if (showOutline) ctx.strokeText(line, x, y + index * (fontSize + 5));
        ctx.fillText(line, x, y + index * (fontSize + 5));
      });
    };
  };

  const downloadImage = (image) => {
    const canvas = canvasRefs.current[image.url];
    if (!canvas) return;

    const link = document.createElement("a");
    link.href = link.href = canvas.toDataURL("image/jpeg", imageQuality / 100);
    link.download = `${image.file.name.replace(/\.[^/.]+$/, "")}_exif.jpg`;
    link.click();
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
    <AppShell navbar={{ width: 300 }}>
      <AppShell.Navbar p="md">
        <Group position="apart">
          <Text size="lg" weight={500}>Settings</Text>
          <Switch
            checked={dark}
            onChange={toggleDarkMode}
            onLabel={<IconSun size={16} />}
            offLabel={<IconMoon size={16} />}
          />
        </Group>
        <ScrollArea>
          <FileInput clearable multiple accept="image/*" placeholder="Upload Images" onChange={handleImageUpload} />
          <Select
            label="Font"
            data={[
              "Arial",
              "Verdana",
              "Times New Roman",
              "Courier New",
              "Georgia",
              "Tahoma",
            ]}
            value={selectedFont}
            onChange={setSelectedFont}
          />

          <Select label="Resolution" data={["1920", "1080", "original"]} value={resolution} onChange={setResolution} />
          <NumberInput label="Image Quality" min={50} max={100} value={imageQuality} onChange={setImageQuality} />
          <Select label="Text Position" data={["top-left", "top-right", "bottom-left", "bottom-right", "bottom-center"]} value={textPosition} onChange={setTextPosition} />
          <NumberInput label="Font Size" min={10} max={150} value={fontSize} onChange={setFontSize} />
          <ColorInput label="Text Color" value={textColor} onChange={setTextColor} />
          <Checkbox label="Enable Outline" checked={showOutline} onChange={(e) => setShowOutline(e.currentTarget.checked)} />
          <MultiSelect label="EXIF Data to Display" data={["camera", "date", "iso", "shutter", "aperture", "focal", "gps", "description"]} value={selectedExifFields} onChange={setSelectedExifFields} />
          <Button fullWidth mt="md" color="green" onClick={downloadAllImages} disabled={images.length === 0}>
            Download All as ZIP
          </Button>
        </ScrollArea>
      </AppShell.Navbar>

      <AppShell.Main>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "20px", padding: "20px" }}>
          {images.map((image) => (
            <div key={image.url} style={{ textAlign: "center" }}>
              <canvas ref={(el) => (canvasRefs.current[image.url] = el)} style={{ maxWidth: "100%", border: "1px solid black" }} />
              <Button mt="sm" color="blue" onClick={() => downloadImage(image)}>Download</Button>
            </div>
          ))}
        </div>
      </AppShell.Main>
    </AppShell>
  );
}
