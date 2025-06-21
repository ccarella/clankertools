import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { PhotoPicker } from '@/components/PhotoPicker';
import '@testing-library/jest-dom';

interface MockFileReader {
  readAsDataURL: jest.Mock;
  onloadend: (() => void) | null;
  result: string;
}

interface FileReaderMock extends jest.Mock {
  mockInstance?: MockFileReader;
}

const mockFileReaderInstances: MockFileReader[] = [];
const FileReaderMock = jest.fn().mockImplementation(() => {
  const reader: MockFileReader = {
    readAsDataURL: jest.fn(function(this: MockFileReader) {
      setTimeout(() => {
        if (this.onloadend) {
          this.onloadend();
        }
      }, 0);
    }),
    onloadend: null,
    result: 'data:image/png;base64,mockbase64data',
  };
  mockFileReaderInstances.push(reader);
  (FileReaderMock as FileReaderMock).mockInstance = reader;
  return reader;
}) as FileReaderMock;

global.FileReader = FileReaderMock as unknown as typeof FileReader;

const mockMediaDevices = {
  getUserMedia: jest.fn()
};

Object.defineProperty(global.navigator, 'mediaDevices', {
  writable: true,
  value: mockMediaDevices
});

describe('PhotoPicker', () => {
  const mockOnImageSelect = jest.fn();
  const mockOnError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockFileReaderInstances.length = 0;
    mockMediaDevices.getUserMedia.mockResolvedValue({
      getTracks: () => [{
        stop: jest.fn()
      }]
    });
  });

  it('should render with default state', () => {
    render(<PhotoPicker onImageSelect={mockOnImageSelect} />);
    
    expect(screen.getByText(/click to upload or drag and drop/i)).toBeInTheDocument();
    expect(screen.getByTestId('photo-picker-dropzone')).toBeInTheDocument();
  });

  it('should handle file upload via click', async () => {
    render(<PhotoPicker onImageSelect={mockOnImageSelect} />);
    
    const file = new File(['test'], 'test.png', { type: 'image/png' });
    const fileInput = screen.getByTestId('file-input');
    
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const reader = (FileReaderMock as FileReaderMock).mockInstance;
      if (reader && reader.onloadend) {
        reader.onloadend();
      }
    });

    await waitFor(() => {
      expect(mockOnImageSelect).toHaveBeenCalledWith(file, 'data:image/png;base64,mockbase64data');
    });
  });

  it('should validate file size', async () => {
    render(<PhotoPicker onImageSelect={mockOnImageSelect} onError={mockOnError} maxSizeMB={5} />);
    
    const largeFile = new File(['x'.repeat(6 * 1024 * 1024)], 'large.png', { type: 'image/png' });
    const fileInput = screen.getByTestId('file-input');
    
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [largeFile] } });
    });

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith('File size exceeds 5MB limit');
      expect(mockOnImageSelect).not.toHaveBeenCalled();
    });
  });

  it('should validate file type', async () => {
    render(<PhotoPicker onImageSelect={mockOnImageSelect} onError={mockOnError} />);
    
    const invalidFile = new File(['test'], 'test.txt', { type: 'text/plain' });
    const fileInput = screen.getByTestId('file-input');
    
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [invalidFile] } });
    });

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith('Please select a valid image file (JPEG, PNG, GIF, WebP)');
      expect(mockOnImageSelect).not.toHaveBeenCalled();
    });
  });

  it('should show image preview after selection', async () => {
    render(<PhotoPicker onImageSelect={mockOnImageSelect} />);
    
    const file = new File(['test'], 'test.png', { type: 'image/png' });
    const fileInput = screen.getByTestId('file-input');
    
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const reader = (FileReaderMock as FileReaderMock).mockInstance;
      if (reader && reader.onloadend) {
        reader.onloadend();
      }
    });

    await waitFor(() => {
      expect(screen.getByAltText('Selected image')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /change/i })).toBeInTheDocument();
    });
  });

  it('should allow changing the selected image', async () => {
    render(<PhotoPicker onImageSelect={mockOnImageSelect} />);
    
    const firstFile = new File(['test1'], 'test1.png', { type: 'image/png' });
    const fileInput = screen.getByTestId('file-input');
    
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [firstFile] } });
      
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const reader = (FileReaderMock as FileReaderMock).mockInstance;
      if (reader && reader.onloadend) {
        reader.onloadend();
      }
    });

    await waitFor(() => {
      expect(mockOnImageSelect).toHaveBeenCalledTimes(1);
    });

    const changeButton = screen.getByRole('button', { name: /change/i });
    fireEvent.click(changeButton);

    const secondFile = new File(['test2'], 'test2.png', { type: 'image/png' });
    
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [secondFile] } });
      
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const reader = (FileReaderMock as FileReaderMock).mockInstance;
      if (reader && reader.onloadend) {
        reader.onloadend();
      }
    });

    await waitFor(() => {
      expect(mockOnImageSelect).toHaveBeenCalledTimes(2);
      expect(mockOnImageSelect).toHaveBeenLastCalledWith(secondFile, 'data:image/png;base64,mockbase64data');
    });
  });

  it('should show take photo button when camera is supported', async () => {
    mockMediaDevices.getUserMedia.mockResolvedValueOnce({
      getTracks: () => [{
        stop: jest.fn()
      }]
    });

    render(<PhotoPicker onImageSelect={mockOnImageSelect} showCamera={true} />);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /take photo/i })).toBeInTheDocument();
    });
  });

  it('should handle camera access denial gracefully', async () => {
    mockMediaDevices.getUserMedia.mockRejectedValueOnce(new Error('Permission denied'));

    render(<PhotoPicker onImageSelect={mockOnImageSelect} showCamera={true} />);
    
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /take photo/i })).not.toBeInTheDocument();
    });
  });

  it('should handle drag and drop', async () => {
    render(<PhotoPicker onImageSelect={mockOnImageSelect} />);
    
    const dropzone = screen.getByTestId('photo-picker-dropzone');
    const file = new File(['test'], 'test.png', { type: 'image/png' });
    
    fireEvent.dragEnter(dropzone, {
      dataTransfer: {
        files: [file],
        types: ['Files']
      }
    });
    
    expect(dropzone).toHaveClass('border-primary');
    
    await act(async () => {
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [file],
          types: ['Files']
        }
      });
      
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const reader = (FileReaderMock as FileReaderMock).mockInstance;
      if (reader && reader.onloadend) {
        reader.onloadend();
      }
    });

    await waitFor(() => {
      expect(mockOnImageSelect).toHaveBeenCalledWith(file, 'data:image/png;base64,mockbase64data');
    });
  });

  it('should support custom accept types', () => {
    render(<PhotoPicker onImageSelect={mockOnImageSelect} acceptTypes="image/jpeg,image/jpg" />);
    
    const fileInput = screen.getByTestId('file-input');
    expect(fileInput).toHaveAttribute('accept', 'image/jpeg,image/jpg');
  });

  it('should show loading state while processing', async () => {
    const slowReader: MockFileReader = {
      readAsDataURL: jest.fn(function(this: MockFileReader) {
        setTimeout(() => {
          if (this.onloadend) {
            this.onloadend();
          }
        }, 100);
      }),
      onloadend: null,
      result: 'data:image/png;base64,mockbase64data',
    };
    
    (FileReaderMock as FileReaderMock).mockImplementationOnce(() => slowReader);
    
    render(<PhotoPicker onImageSelect={mockOnImageSelect} />);
    
    const file = new File(['test'], 'test.png', { type: 'image/png' });
    const fileInput = screen.getByTestId('file-input');
    
    fireEvent.change(fileInput, { target: { files: [file] } });
    
    expect(screen.getByText(/processing/i)).toBeInTheDocument();
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
      if (slowReader.onloadend) {
        slowReader.onloadend();
      }
    });
    
    expect(screen.queryByText(/processing/i)).not.toBeInTheDocument();
  });

  it('should clear image when requested', async () => {
    const { rerender } = render(<PhotoPicker onImageSelect={mockOnImageSelect} />);
    
    const file = new File(['test'], 'test.png', { type: 'image/png' });
    const fileInput = screen.getByTestId('file-input');
    
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const reader = (FileReaderMock as FileReaderMock).mockInstance;
      if (reader && reader.onloadend) {
        reader.onloadend();
      }
    });

    expect(screen.getByAltText('Selected image')).toBeInTheDocument();
    
    rerender(<PhotoPicker onImageSelect={mockOnImageSelect} value={null} />);
    
    await waitFor(() => {
      expect(screen.queryByAltText('Selected image')).not.toBeInTheDocument();
      expect(screen.getByText(/click to upload or drag and drop/i)).toBeInTheDocument();
    });
  });

  it('should handle mobile capture attribute', () => {
    render(<PhotoPicker onImageSelect={mockOnImageSelect} capture="environment" />);
    
    const fileInput = screen.getByTestId('file-input');
    expect(fileInput).toHaveAttribute('capture', 'environment');
  });

  it('should display custom className', () => {
    render(<PhotoPicker onImageSelect={mockOnImageSelect} className="custom-class" />);
    
    const container = screen.getByTestId('photo-picker-container');
    expect(container).toHaveClass('custom-class');
  });
});