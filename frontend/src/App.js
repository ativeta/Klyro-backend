import React, { useState } from 'react';
import axios from 'axios';
import {
  Box,
  Button,
  Container,
  Heading,
  Image,
  Text,
  VStack,
  HStack,
  Checkbox,
  Alert,
  AlertIcon,
  Spinner,
  Badge,
  SimpleGrid,
  Flex,
  Divider,
} from '@chakra-ui/react';

function App() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [options, setOptions] = useState({
    fillMissing: false,
    removeOutliers: false,
  });

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setError(null);
    setResult(null);
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select an Excel or CSV file');
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    const queryParams = new URLSearchParams({
      fill_missing: options.fillMissing,
      remove_outliers: options.removeOutliers,
    });

    try {
      const response = await axios.post(
        `http://localhost:8000/clean?${queryParams}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      setResult(response.data);
    } catch (err) {
      setError('Error: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const downloadCleanedFile = () => {
    if (!result || !result.cleaned_file_base64) return;

    const byteCharacters = atob(result.cleaned_file_base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);

    const blob = new Blob([byteArray], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = result.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Container maxW="container.lg" py={10}>
      <VStack spacing={8} align="stretch">
        {/* Header with Logo */}
        <Box textAlign="center" pb={6}>
          <Image
            src="/DataAid.png"
            alt="AI Excel Assistant Logo"
            maxH="80px"
            mx="auto"
            mb={4}
          />
          <Text fontSize="lg" color="gray.600">
            Upload your data to get cleaned datasets and AI-powered analysis
            insights
          </Text>
        </Box>

        {/* Upload Section */}
        <Box borderWidth="1px" borderRadius="lg" p={6} boxShadow="md" bg="white">
          <VStack spacing={4}>
            <Box w="100%">
              <input
                type="file"
                id="file-input"
                accept=".xlsx,.csv"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <Button
                as="label"
                htmlFor="file-input"
                bg="brand.500"
                color="white"
                _hover={{ bg: 'brand.600' }}
                size="lg"
                width="100%"
                cursor="pointer"
              >
                📁 {file ? file.name : 'Select Excel or CSV file'}
              </Button>
              {file && (
                <Text
                  mt={2}
                  fontSize="sm"
                  color="brand.700"
                  textAlign="center"
                >
                  ✓ Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </Text>
              )}
            </Box>

            {/* Advanced Options */}
            <Box w="100%" p={4} bg="brand.50" borderRadius="md">
              <Text fontWeight="bold" mb={3} color="brand.800">
                Advanced Options:
              </Text>
              <HStack spacing={6}>
                <Checkbox
                  isChecked={options.fillMissing}
                  onChange={(e) =>
                    setOptions({
                      ...options,
                      fillMissing: e.target.checked,
                    })
                  }
                  colorScheme="brand"
                >
                  Fill missing values
                </Checkbox>
                <Checkbox
                  isChecked={options.removeOutliers}
                  onChange={(e) =>
                    setOptions({
                      ...options,
                      removeOutliers: e.target.checked,
                    })
                  }
                  colorScheme="brand"
                >
                  Remove outliers
                </Checkbox>
              </HStack>
            </Box>

            {/* Main Button */}
            <Button
              bg="brand.500"
              color="white"
              _hover={{ bg: 'brand.600' }}
              size="lg"
              onClick={handleUpload}
              isLoading={loading}
              loadingText="Processing..."
              w="100%"
              isDisabled={!file}
            >
              Analyze with AI
            </Button>
          </VStack>
        </Box>

        {/* Error Alert */}
        {error && (
          <Alert status="error" borderRadius="md">
            <AlertIcon />
            {error}
          </Alert>
        )}

        {/* Loading State */}
        {loading && (
          <Box p={8} textAlign="center" bg="brand.50" borderRadius="lg">
            <VStack spacing={4}>
              <Spinner size="xl" color="brand.500" />
              <Text fontSize="lg" color="brand.700">
                Processing data and consulting AI...
              </Text>
              <Text fontSize="sm" color="brand.600">
                This may take a few seconds
              </Text>
            </VStack>
          </Box>
        )}

        {/* Results */}
        {result && (
          <VStack spacing={6} align="stretch">
            <Heading
              size="lg"
              borderBottom="2px"
              borderColor="brand.500"
              pb={2}
              color="brand.700"
            >
              📊 Analysis Results
            </Heading>

            {/* Statistics */}
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
              <Box
                p={4}
                bg="brand.50"
                borderRadius="md"
                borderLeft="4px solid"
                borderColor="brand.400"
              >
                <Text fontWeight="bold" color="brand.800">
                  Initial Rows
                </Text>
                <Text fontSize="2xl" color="brand.600">
                  {result.initial_row_count}
                </Text>
              </Box>
              <Box
                p={4}
                bg="brand.100"
                borderRadius="md"
                borderLeft="4px solid"
                borderColor="brand.500"
              >
                <Text fontWeight="bold" color="brand.800">
                  Final Rows
                </Text>
                <Text fontSize="2xl" color="brand.700">
                  {result.row_count}
                </Text>
                {result.rows_removed > 0 && (
                  <Text fontSize="sm" color="brand.600">
                    Removed {result.rows_removed} rows
                  </Text>
                )}
              </Box>
            </SimpleGrid>

            {/* Cleaning Report */}
            {result.cleaning_report && result.cleaning_report.length > 0 && (
              <Box
                bg="brand.50"
                p={4}
                borderRadius="md"
                borderLeft="4px solid"
                borderColor="brand.500"
              >
                <Heading size="sm" mb={3} color="brand.800">
                  🧹 Cleaning Actions Performed
                </Heading>
                <VStack align="start" spacing={2}>
                  {result.cleaning_report.map((action, index) => (
                    <Text key={index} color="brand.700">
                      ✓ {action}
                    </Text>
                  ))}
                </VStack>
              </Box>
            )}

            {/* AI Suggestions - Three Cards */}
            {result.AI_suggestions && (
              <Box>
                <Heading
                  size="md"
                  mb={4}
                  color="brand.800"
                  textAlign="center"
                >
                  Suggestions for Deeper Data Analysis
                </Heading>
                <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
                  {result.AI_suggestions.map((suggestion, index) => (
                    <Box
                      key={index}
                      bg="white"
                      borderRadius="xl"
                      boxShadow="lg"
                      p={6}
                      borderTop="4px solid"
                      borderColor={`brand.${400 + index * 100}`}
                      transition="all 0.3s"
                      _hover={{
                        transform: 'translateY(-4px)',
                        boxShadow: 'xl',
                      }}
                    >
                      {/* Card Number Badge */}
                      <Badge
                        colorScheme="brand"
                        fontSize="lg"
                        mb={3}
                        borderRadius="full"
                        px={3}
                        py={1}
                      >
                        #{index + 1}
                      </Badge>

                      {/* Title */}
                      <Heading size="md" mb={2} color="brand.700">
                        {suggestion.title}
                      </Heading>

                      {/* Description */}
                      <Text fontSize="sm" color="gray.600" mb={4}>
                        {suggestion.description}
                      </Text>

                      {/* Divider */}
                      <Divider mb={4} borderColor="brand.100" />

                      {/* Steps */}
                      <VStack align="start" spacing={2}>
                        <Text
                          fontWeight="bold"
                          fontSize="sm"
                          color="brand.600"
                        >
                          How to perform:
                        </Text>
                        {suggestion.steps.map((step, stepIndex) => (
                          <Flex key={stepIndex} gap={2} align="start">
                            <Text color="brand.500" fontSize="md" mt="2px">
                              •
                            </Text>
                            <Text fontSize="sm" color="gray.700" flex={1}>
                              {step}
                            </Text>
                          </Flex>
                        ))}
                      </VStack>
                    </Box>
                  ))}
                </SimpleGrid>
              </Box>
            )}

            {/* Download Section */}
            <Box
              bg="brand.100"
              p={6}
              borderRadius="md"
              textAlign="center"
              borderLeft="4px solid"
              borderColor="brand.600"
            >
              <VStack spacing={4}>
                <Heading size="sm" color="brand.800">
                  💾 Cleaned Dataset Ready
                </Heading>
                <Text color="brand.700">
                  Your file has been cleaned and is ready for download
                </Text>
                <Button
                  leftIcon={<Text>⬇️</Text>}
                  bg="brand.500"
                  color="white"
                  _hover={{ bg: 'brand.600' }}
                  size="lg"
                  onClick={downloadCleanedFile}
                >
                  Download Cleaned Excel
                </Button>
                <Text fontSize="sm" color="brand.600">
                  {result.filename}
                </Text>
              </VStack>
            </Box>
          </VStack>
        )}
      </VStack>
    </Container>
  );
}

export default App;
