import React from 'react';
import { View, Text, TextInput, TextInputProps } from 'react-native';

interface InputGroupProps extends Omit<TextInputProps, 'onChange'> {
  label: string;
  value: string;
  onChange: (text: string) => void;
}

export default function InputGroup({ label, value, onChange, placeholder, style, ...rest }: InputGroupProps) {
  return (
    <View>
      <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10, paddingHorizontal: 4 }}>
        {label}
      </Text>
      <TextInput 
        style={[
          {
            backgroundColor: '#0F172A',
            color: '#FFFFFF',
            fontSize: 16,
            fontWeight: '700',
            paddingVertical: 18,
            paddingHorizontal: 20,
            borderRadius: 20,
            borderWidth: 1.5,
            borderColor: '#1E293B',
          },
          style,
        ]}
        placeholder={placeholder}
        placeholderTextColor="#475569"
        selectionColor="#3B82F6"
        value={value}
        onChangeText={onChange}
        {...rest}
      />
    </View>
  );
}
