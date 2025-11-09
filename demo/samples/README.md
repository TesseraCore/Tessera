# Test Images for Tessera Demo

This directory contains test images for the Tessera demo application. All files in this directory are gitignored.

## Where to Get Test Images

### TIFF Files
- **OpenSlide Test Data**: https://github.com/openslide/openslide/tree/master/testdata
- **Sample Files**: https://sample-files.com/images/tiff/
- **OME Sample Files**: https://www.openmicroscopy.org/site/support/ome-model/sample-files.html

### DICOM Files
- **Rubo Medical**: https://www.rubomedical.com/dicom_files/
- **Weasis Samples**: https://weasis.org/en/demo/index.print.html
- **DICOM Library**: https://www.dicomlibrary.com/

### SVS (Aperio) Files
- **OpenSlide Test Data**: Check OpenSlide repository for sample SVS files
- **Pathomation**: May have sample files available
- Note: SVS files are typically large (100MB+) whole slide images

### SCN (Leica) Files
- **Leica Sample Data**: Contact Leica or check their documentation
- **Pathomation**: May have sample files available
- Note: SCN files are proprietary Leica format

### BIFF (Ventana) Files
- **Ventana Sample Data**: Contact Ventana or check their documentation
- **Pathomation**: May have sample files available
- Note: BIFF files are proprietary Ventana format

## Adding Test Images

Simply place any test images in this directory. The demo will automatically discover and load them when you click "Load Test Image".

Supported formats:
- TIFF (.tiff, .tif)
- DICOM (.dcm, .dicom)
- SVS (.svs)
- SCN (.scn)
- BIFF (.bif)
- PNG, JPEG, WebP (standard formats)

## Note

For proprietary formats (SVS, SCN, BIFF), you may need to obtain sample files from vendors or use publicly available datasets. These formats are typically used for whole slide imaging in pathology and can be very large files.

